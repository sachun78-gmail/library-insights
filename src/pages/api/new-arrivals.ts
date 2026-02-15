import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';

export const prerender = false;

const CACHE_TTL = 6 * 60 * 60; // 6시간

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

  const authKey = getEnvVar(locals, 'DATA4LIBRARY_API_KEY');

  if (!authKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const endDt = today.toISOString().split('T')[0];
    const startDt = weekAgo.toISOString().split('T')[0];

    const apiUrl = `https://data4library.kr/api/loanItemSrch?authKey=${authKey}&startDt=${startDt}&endDt=${endDt}&pageNo=1&pageSize=20&format=json`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    await setCachedResponse(cacheKey, data, CACHE_TTL);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('New arrivals API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
