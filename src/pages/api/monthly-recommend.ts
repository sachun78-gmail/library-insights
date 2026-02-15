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

export const GET: APIRoute = async ({ request, locals }) => {
  // 날짜 기반 캐시 키: 하루 1회만 새 추천 생성
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `${new URL(request.url).origin}/api/monthly-recommend?date=${today}`;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  const apiKey = getEnvVar(locals, 'DATA4LIBRARY_API_KEY');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get current month in YYYY-MM format
    const now = new Date();
    // Use previous month since current month data might not be available yet
    now.setMonth(now.getMonth() - 1);
    const month = now.toISOString().slice(0, 7);

    // Step 1: Get monthly keywords
    const keywordsUrl = `https://data4library.kr/api/monthlyKeywords?authKey=${apiKey}&month=${month}&format=json`;
    const keywordsResponse = await fetch(keywordsUrl);
    const keywordsData = await keywordsResponse.json();

    const keywords = keywordsData.response?.keywords || [];

    if (keywords.length === 0) {
      return new Response(JSON.stringify({
        error: 'No keywords found',
        keyword: null,
        book: null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Shuffle keywords and try until we find a book
    const shuffledKeywords = [...keywords].sort(() => Math.random() - 0.5);

    let keyword = '';
    let book = null;

    for (const keywordObj of shuffledKeywords) {
      const tryKeyword = keywordObj.keyword?.word || '';
      if (!tryKeyword) continue;

      // Search for books with this keyword
      const searchUrl = `https://data4library.kr/api/srchBooks?authKey=${apiKey}&keyword=${encodeURIComponent(tryKeyword)}&pageNo=1&pageSize=10&format=json`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      const books = searchData.response?.docs || [];

      if (books.length > 0) {
        // Found books! Pick a random one
        const randomBook = books[Math.floor(Math.random() * Math.min(books.length, 5))];
        book = randomBook.doc;
        keyword = tryKeyword;
        break;
      }
    }

    if (!book) {
      return new Response(JSON.stringify({
        error: 'No books found for any keyword',
        keyword: null,
        book: null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 3: Get more details about the book using ISBN if available
    let bookDetail = null;
    if (book.isbn13) {
      const detailUrl = `https://data4library.kr/api/srchDtlList?authKey=${apiKey}&isbn13=${book.isbn13}&format=json`;
      const detailResponse = await fetch(detailUrl);
      const detailData = await detailResponse.json();

      if (detailData.response?.detail?.[0]?.book) {
        bookDetail = detailData.response.detail[0].book;
      }
    }

    // Merge book info
    const result = {
      keyword,
      month,
      book: {
        bookname: book.bookname || bookDetail?.bookname || '',
        authors: book.authors || bookDetail?.authors || '',
        publisher: book.publisher || bookDetail?.publisher || '',
        publication_year: book.publication_year || bookDetail?.publication_year || '',
        isbn13: book.isbn13 || bookDetail?.isbn13 || '',
        bookImageURL: book.bookImageURL || bookDetail?.bookImageURL || '',
        description: bookDetail?.description || book.description || '',
        class_nm: book.class_nm || bookDetail?.class_nm || '',
        loan_count: book.loan_count || bookDetail?.loan_count || ''
      }
    };

    await setCachedResponse(cacheKey, result, CACHE_TTL);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Monthly recommend API error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch recommendation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
