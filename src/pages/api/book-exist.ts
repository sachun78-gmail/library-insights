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
  const libCode = url.searchParams.get('libCode') || '';

  if (!isbn || !libCode) {
    return new Response(JSON.stringify({ error: 'isbn and libCode are required' }), {
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
    const apiUrl = `https://data4library.kr/api/bookExist?authKey=${authKey}&isbn13=${isbn}&libCode=${libCode}&format=json`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    const result = data.response?.result || {};
    return new Response(JSON.stringify({
      hasBook: result.hasBook === 'Y',
      loanAvailable: result.loanAvailable === 'Y'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Book exist API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
