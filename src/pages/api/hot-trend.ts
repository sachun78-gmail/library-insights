import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';

export const prerender = false;

const CACHE_TTL = 6 * 60 * 60; // 6시간

// Helper to get env variable (works in both local and Cloudflare)
function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const cacheKey = request.url;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  const url = new URL(request.url);

  // 기본값: 오늘 날짜 (API는 최근 날짜 데이터를 반환)
  const today = new Date();
  const defaultDate = today.toISOString().split('T')[0];
  const searchDt = url.searchParams.get('searchDt') || defaultDate;

  const authKey = getEnvVar(locals, 'DATA4LIBRARY_API_KEY');

  if (!authKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 도서관 정보나루 - 대출 급상승 도서 API (HTTPS 필수 - Cloudflare)
    const apiUrl = `https://data4library.kr/api/hotTrend?authKey=${authKey}&format=json&searchDt=${searchDt}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    await setCachedResponse(cacheKey, data, CACHE_TTL);

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
