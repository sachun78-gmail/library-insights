import type { APIRoute } from 'astro';

export const prerender = false;

// Helper to get env variable (works in both local and Cloudflare)
function getEnvVar(locals: any, key: string): string | undefined {
  // Try Cloudflare runtime env first
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  // Fallback to import.meta.env (local dev)
  return (import.meta.env as any)[key];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const isbn = url.searchParams.get('isbn') || '';
  const pageNo = url.searchParams.get('pageNo') || '1';
  const pageSize = url.searchParams.get('pageSize') || '10';

  if (!keyword && !isbn) {
    return new Response(JSON.stringify({ error: 'Keyword or ISBN is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const authKey = getEnvVar(locals, 'DATA4LIBRARY_API_KEY');

  if (!authKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 도서관 정보나루 도서 검색 API (HTTPS 필수 - Cloudflare)
    let apiUrl;
    if (isbn) {
      // ISBN search
      apiUrl = `https://data4library.kr/api/srchBooks?authKey=${authKey}&isbn=${encodeURIComponent(isbn)}&pageNo=${pageNo}&pageSize=${pageSize}&format=json`;
    } else {
      // Keyword search
      apiUrl = `https://data4library.kr/api/srchBooks?authKey=${authKey}&title=${encodeURIComponent(keyword)}&pageNo=${pageNo}&pageSize=${pageSize}&format=json`;
    }

    const response = await fetch(apiUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
