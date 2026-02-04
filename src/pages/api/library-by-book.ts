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
  const isbn = url.searchParams.get('isbn') || '';
  const region = url.searchParams.get('region') || '';
  const dtlRegion = url.searchParams.get('dtl_region') || '';

  if (!isbn) {
    return new Response(JSON.stringify({ error: 'ISBN is required' }), {
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
    // 도서관 정보나루 - 도서 소장 도서관 조회 API
    let apiUrl = `http://data4library.kr/api/libSrchByBook?authKey=${authKey}&isbn=${isbn}&format=json`;

    if (region) {
      apiUrl += `&region=${region}`;
    }

    if (dtlRegion) {
      apiUrl += `&dtl_region=${dtlRegion}`;
    }

    const response = await fetch(apiUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Library search API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
