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
  const title = url.searchParams.get('title') || '';

  if (!isbn && !title) {
    return new Response(JSON.stringify({ error: 'ISBN or title is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const clientId = getEnvVar(locals, 'NAVER_CLIENT_ID');
  const clientSecret = getEnvVar(locals, 'NAVER_CLIENT_SECRET');

  // 검색어 준비
  const searchQuery = isbn ? isbn.replace(/-/g, '') : title;
  const naverSearchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(searchQuery + ' 책')}`;

  // 네이버 API 키가 없으면 검색 링크만 반환
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({
      success: true,
      book: {
        title: title || '',
        description: '',
        link: naverSearchUrl,
        price: null,
        discount: null
      },
      fallback: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 네이버 책 검색 API - ISBN으로 검색하거나 제목으로 검색
    const query = isbn ? `isbn:${isbn.replace(/-/g, '')}` : title;
    const apiUrl = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=1`;

    const response = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    if (!response.ok) {
      // API 에러 시 검색 링크 반환
      return new Response(JSON.stringify({
        success: true,
        book: {
          title: title || '',
          description: '',
          link: naverSearchUrl,
          price: null,
          discount: null
        },
        fallback: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    // 검색 결과가 있으면 첫 번째 결과 반환
    if (data.items && data.items.length > 0) {
      const book = data.items[0];
      return new Response(JSON.stringify({
        success: true,
        book: {
          title: book.title?.replace(/<[^>]*>/g, ''), // HTML 태그 제거
          author: book.author?.replace(/<[^>]*>/g, ''),
          publisher: book.publisher,
          pubdate: book.pubdate,
          description: book.description?.replace(/<[^>]*>/g, ''),
          isbn: book.isbn,
          image: book.image,
          link: book.link, // 네이버 책 상세 페이지 링크
          discount: book.discount, // 판매가
          price: book.price // 정가
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 검색 결과 없으면 검색 링크 반환
    return new Response(JSON.stringify({
      success: true,
      book: {
        title: title || '',
        description: '',
        link: naverSearchUrl,
        price: null,
        discount: null
      },
      fallback: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Naver Book API error:', error);
    // 에러 시에도 검색 링크 반환
    return new Response(JSON.stringify({
      success: true,
      book: {
        title: title || '',
        description: '',
        link: naverSearchUrl,
        price: null,
        discount: null
      },
      fallback: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
