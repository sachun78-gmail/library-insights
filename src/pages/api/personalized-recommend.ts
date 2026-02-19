import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';

export const prerender = false;

const CACHE_TTL = 24 * 60 * 60; // 24시간

function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

// Extract book objects from various response structures
function extractBooks(data: any): any[] {
  if (!data || !data.response) return [];

  const docs = data.response.docs;
  if (Array.isArray(docs) && docs.length > 0) {
    return docs.map((item: any) => item.book || item.doc || item).filter(Boolean);
  }

  const list = data.response.list;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((item: any) => item.book || item.doc || item).filter(Boolean);
  }

  return [];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const isbn13 = url.searchParams.get('isbn13') || '';

  if (!isbn13) {
    return new Response(JSON.stringify({ error: 'isbn13 parameter required', book: null }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 날짜 + ISBN 기반 캐시 키
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `${url.origin}/api/personalized-recommend?isbn13=${isbn13}&date=${today}`;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  const apiKey = getEnvVar(locals, 'DATA4LIBRARY_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured', book: null }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Step 1: recommandList (mania type, default)
    const maniaUrl = `https://data4library.kr/api/recommandList?authKey=${apiKey}&isbn13=${isbn13}&format=json`;
    const maniaRes = await fetch(maniaUrl);
    const maniaData = await maniaRes.json();
    let books = extractBooks(maniaData);

    // Step 2: type=reader로 재시도
    if (books.length === 0) {
      const readerUrl = `https://data4library.kr/api/recommandList?authKey=${apiKey}&isbn13=${isbn13}&type=reader&format=json`;
      const readerRes = await fetch(readerUrl);
      const readerData = await readerRes.json();
      books = extractBooks(readerData);
    }

    if (books.length === 0) {
      const result = { book: null, source: 'personalized' };
      await setCachedResponse(cacheKey, result, CACHE_TTL);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 첫 번째 도서 추출
    const firstBook = books[0];
    const result = {
      book: {
        bookname: firstBook.bookname || '',
        authors: firstBook.authors || '',
        publisher: firstBook.publisher || '',
        publication_year: firstBook.publication_year || '',
        isbn13: firstBook.isbn13 || '',
        bookImageURL: firstBook.bookImageURL || '',
        description: firstBook.description || '',
        class_nm: firstBook.class_nm || '',
      },
      source: 'personalized',
    };

    await setCachedResponse(cacheKey, result, CACHE_TTL);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Personalized recommend API error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch personalized recommendation',
      book: null,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
