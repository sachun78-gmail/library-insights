import type { APIRoute } from 'astro';

export const prerender = false;

// Helper to get env variable (works in both local and Cloudflare)
function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const startDt = url.searchParams.get('startDt') || '';
  const endDt = url.searchParams.get('endDt') || '';
  const gender = url.searchParams.get('gender') || ''; // 0: 전체, 1: 남성, 2: 여성
  const fromAge = url.searchParams.get('from_age') || '';
  const toAge = url.searchParams.get('to_age') || '';
  const region = url.searchParams.get('region') || '';
  const pageNo = url.searchParams.get('pageNo') || '1';
  const pageSize = url.searchParams.get('pageSize') || '10';

  const authKey = getEnvVar(locals, 'DATA4LIBRARY_API_KEY');

  if (!authKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 도서관 정보나루 - 인기대출도서 조회 API
    let apiUrl = `http://data4library.kr/api/loanItemSrch?authKey=${authKey}&format=json&pageNo=${pageNo}&pageSize=${pageSize}`;

    if (startDt) apiUrl += `&startDt=${startDt}`;
    if (endDt) apiUrl += `&endDt=${endDt}`;
    if (gender) apiUrl += `&gender=${gender}`;
    if (fromAge) apiUrl += `&from_age=${fromAge}`;
    if (toAge) apiUrl += `&to_age=${toAge}`;
    if (region) apiUrl += `&region=${region}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Popular books API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
