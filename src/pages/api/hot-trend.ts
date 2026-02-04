import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);

  // 기본값: 오늘 날짜 (API는 최근 날짜 데이터를 반환)
  const today = new Date();
  const defaultDate = today.toISOString().split('T')[0];
  const searchDt = url.searchParams.get('searchDt') || defaultDate;

  const authKey = import.meta.env.DATA4LIBRARY_API_KEY;

  if (!authKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 도서관 정보나루 - 대출 급상승 도서 API
    const apiUrl = `http://data4library.kr/api/hotTrend?authKey=${authKey}&format=json&searchDt=${searchDt}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Hot trend API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
