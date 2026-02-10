import type { APIRoute } from 'astro';
import OpenAI from 'openai';

export const prerender = false;

function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

const regionCenters = [
  { code: '11', name: '서울', lat: 37.5665, lon: 126.9780 },
  { code: '21', name: '부산', lat: 35.1796, lon: 129.0756 },
  { code: '22', name: '대구', lat: 35.8714, lon: 128.6014 },
  { code: '23', name: '인천', lat: 37.4563, lon: 126.7052 },
  { code: '24', name: '광주', lat: 35.1595, lon: 126.8526 },
  { code: '25', name: '대전', lat: 36.3504, lon: 127.3845 },
  { code: '26', name: '울산', lat: 35.5384, lon: 129.3114 },
  { code: '29', name: '세종', lat: 36.4800, lon: 127.0000 },
  { code: '31', name: '경기', lat: 37.4138, lon: 127.5183 },
  { code: '32', name: '강원', lat: 37.8228, lon: 128.1555 },
  { code: '33', name: '충북', lat: 36.6357, lon: 127.4917 },
  { code: '34', name: '충남', lat: 36.5184, lon: 126.8000 },
  { code: '35', name: '전북', lat: 35.8203, lon: 127.1089 },
  { code: '36', name: '전남', lat: 34.8161, lon: 126.4629 },
  { code: '37', name: '경북', lat: 36.4919, lon: 128.8889 },
  { code: '38', name: '경남', lat: 35.4606, lon: 128.2132 },
  { code: '39', name: '제주', lat: 33.4890, lon: 126.4983 },
];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearestRegions(lat: number, lon: number, count = 2) {
  return regionCenters
    .map(r => ({ ...r, dist: haversineDistance(lat, lon, r.lat, r.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count);
}

const SYSTEM_PROMPT = `너는 전 세계 출판 트렌드와 독자들의 니즈를 꿰뚫고 있는 '글로벌 북 큐레이션 전문가'야.
사용자 프롬프트에 맞는 도서를 산출해줘. 대한민국 공공도서관에 소장되어 있을 법한 도서 위주로 10권 추천해줘.
도서 제목은 반드시 한국어 정식 출판 제목만 사용해. 영문 병기, 괄호 안 원제, 부제는 포함하지 마.
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.
[
  { "title": "도서 제목", "author": "저자명" },
  ...
]`;

// Clean up AI-generated title for data4library search
function cleanTitle(title: string): string {
  // Remove parenthetical text (English titles, etc)
  let cleaned = title.replace(/\s*\(.*?\)\s*/g, '').trim();
  // Remove subtitle after colon
  cleaned = cleaned.replace(/\s*:.*$/, '').trim();
  return cleaned;
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Extract book objects from various response structures
function extractBooks(data: any): any[] {
  if (!data || !data.response) return [];

  // Try docs array (common pattern)
  const docs = data.response.docs;
  if (Array.isArray(docs) && docs.length > 0) {
    return docs.map((item: any) => item.book || item.doc || item).filter(Boolean);
  }

  // Try list array
  const list = data.response.list;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((item: any) => item.book || item.doc || item).filter(Boolean);
  }

  return [];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const lat = parseFloat(url.searchParams.get('lat') || '');
  const lon = parseFloat(url.searchParams.get('lon') || '');

  if (!keyword) {
    return jsonResponse({ error: '검색어를 입력해주세요.' }, 400);
  }

  const authKey = getEnvVar(locals, 'DATA4LIBRARY_API_KEY');
  const openaiKey = getEnvVar(locals, 'OPENAI_API_KEY');

  if (!openaiKey) {
    return jsonResponse({ error: 'OpenAI API key not configured' }, 500);
  }
  if (!authKey) {
    return jsonResponse({ error: 'Library API key not configured' }, 500);
  }

  try {
    // ========================================
    // Step 1: OpenAI - Get book recommendations
    // ========================================
    console.log('[AI-Search] Step 1: Calling OpenAI for keyword:', keyword);
    const openai = new OpenAI({ apiKey: openaiKey });

    const aiResponse = await openai.responses.create({
      model: 'gpt-5-mini',
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
        { role: 'user', content: [{ type: 'input_text', text: keyword }] }
      ]
    });

    let aiBooks: Array<{ title: string; author: string }>;
    try {
      aiBooks = JSON.parse(aiResponse.output_text);
      if (!Array.isArray(aiBooks)) throw new Error('Not an array');
    } catch {
      console.error('[AI-Search] Failed to parse AI response:', aiResponse.output_text);
      return jsonResponse({ error: 'AI 응답 파싱에 실패했습니다.' }, 500);
    }
    console.log('[AI-Search] Step 1 done: got', aiBooks.length, 'AI recommendations');

    // ========================================
    // Step 2: Find seed books in data4library
    // ========================================
    console.log('[AI-Search] Step 2: Searching data4library for seed books...');
    const seedSearchResults = await Promise.all(
      aiBooks.slice(0, 7).map(async (rec) => {
        try {
          const searchUrl = `https://data4library.kr/api/srchBooks?authKey=${authKey}&keyword=${encodeURIComponent(cleanTitle(rec.title))}&pageNo=1&pageSize=1&format=json`;
          const res = await fetch(searchUrl);
          const data = await res.json();
          // Check for API error response
          if (data.response?.error) {
            console.error('[AI-Search] srchBooks API error for:', rec.title, data.response.error);
            return null;
          }
          const docs = data.response?.docs || [];
          return docs.length > 0 ? docs[0].doc : null;
        } catch (e) {
          console.error('[AI-Search] srchBooks error for:', rec.title, e);
          return null;
        }
      })
    );

    // Collect ALL seed books with isbn13
    const seedBooks = seedSearchResults.filter((b: any) => b?.isbn13);
    console.log('[AI-Search] Step 2 done: found', seedBooks.length, 'seed books with ISBN');

    if (seedBooks.length === 0) {
      console.log('[AI-Search] No seed books found, returning ai-only');
      return jsonResponse({
        mode: 'ai-only',
        recommendations: aiBooks.slice(0, 10),
        seedBook: null,
        regions: []
      });
    }

    const primarySeed = seedBooks[0];
    // Use up to 5 seed ISBNs (semicolon-separated, API supports this)
    const seedIsbns = seedBooks.slice(0, 5).map((b: any) => b.isbn13).join(';');
    console.log('[AI-Search] Using seed ISBNs:', seedIsbns);

    // ========================================
    // Step 3: Get recommendations
    // Try usageAnalysisList first (single call, reliable)
    // Then recommandList as backup
    // Then srchBooks results as final fallback
    // ========================================
    const seen = new Set<string>();
    seedBooks.forEach((b: any) => seen.add(b.isbn13));
    let allRecs: any[] = [];

    // --- 3a: Try usageAnalysisList (returns maniaRecBooks + readerRecBooks) ---
    console.log('[AI-Search] Step 3a: Trying usageAnalysisList...');
    try {
      const usageUrl = `https://data4library.kr/api/usageAnalysisList?authKey=${authKey}&isbn13=${primarySeed.isbn13}&format=json`;
      const usageRes = await fetch(usageUrl);
      const usageData = await usageRes.json();

      if (usageData.response?.error) {
        console.error('[AI-Search] usageAnalysisList API error:', usageData.response.error);
        throw new Error(usageData.response.error);
      }

      const maniaRec = usageData.response?.maniaRecBooks || [];
      const readerRec = usageData.response?.readerRecBooks || [];
      const coLoan = usageData.response?.coLoanBooks || [];

      console.log('[AI-Search] usageAnalysisList results - mania:', maniaRec.length, 'reader:', readerRec.length, 'coLoan:', coLoan.length);

      for (const item of [...maniaRec, ...readerRec, ...coLoan]) {
        const book = item.book || item;
        const isbn = book.isbn13 || book.isbn;
        if (isbn && !seen.has(isbn)) {
          seen.add(isbn);
          allRecs.push(book);
        }
      }
      console.log('[AI-Search] Step 3a done: got', allRecs.length, 'unique recs from usageAnalysisList');
    } catch (e) {
      console.error('[AI-Search] usageAnalysisList failed:', e);
    }

    // --- 3b: If not enough, try recommandList with multiple ISBNs ---
    if (allRecs.length < 10) {
      console.log('[AI-Search] Step 3b: Trying recommandList with ISBNs:', seedIsbns);
      try {
        const [maniaData, readerData] = await Promise.all([
          fetch(`https://data4library.kr/api/recommandList?authKey=${authKey}&isbn13=${seedIsbns}&format=json`)
            .then(r => r.json()).catch(() => ({})),
          fetch(`https://data4library.kr/api/recommandList?authKey=${authKey}&isbn13=${seedIsbns}&type=reader&format=json`)
            .then(r => r.json()).catch(() => ({})),
        ]);

        console.log('[AI-Search] recommandList mania raw response keys:', JSON.stringify(Object.keys(maniaData?.response || {})));
        console.log('[AI-Search] recommandList reader raw response keys:', JSON.stringify(Object.keys(readerData?.response || {})));

        const maniaBooks = extractBooks(maniaData);
        const readerBooks = extractBooks(readerData);
        console.log('[AI-Search] recommandList parsed - mania:', maniaBooks.length, 'reader:', readerBooks.length);

        for (const book of [...maniaBooks, ...readerBooks]) {
          const isbn = book.isbn13 || book.isbn;
          if (isbn && !seen.has(isbn)) {
            seen.add(isbn);
            allRecs.push(book);
          }
        }
        console.log('[AI-Search] Step 3b done: total', allRecs.length, 'recs now');
      } catch (e) {
        console.error('[AI-Search] recommandList failed:', e);
      }
    }

    // --- 3c: If still no recs, use seed books themselves + search more AI titles ---
    if (allRecs.length === 0) {
      console.log('[AI-Search] Step 3c: Using seed books as fallback recs');
      // First, add all seed books directly as recommendations
      for (const book of seedBooks) {
        allRecs.push(book);
      }
      console.log('[AI-Search] Step 3c: added', seedBooks.length, 'seed books to recs');

      // Then search remaining AI titles for additional books
      if (allRecs.length < 10) {
        const extraResults = await Promise.all(
          aiBooks.slice(seedBooks.length, 10).map(async (rec) => {
            try {
              const searchUrl = `https://data4library.kr/api/srchBooks?authKey=${authKey}&keyword=${encodeURIComponent(cleanTitle(rec.title))}&pageNo=1&pageSize=1&format=json`;
              const res = await fetch(searchUrl);
              const data = await res.json();
              if (data.response?.error) {
                console.error('[AI-Search] srchBooks fallback API error:', data.response.error);
                return null;
              }
              const docs = data.response?.docs || [];
              return docs.length > 0 ? docs[0].doc : null;
            } catch { return null; }
          })
        );

        for (const book of extraResults) {
          if (book?.isbn13 && !seen.has(book.isbn13)) {
            seen.add(book.isbn13);
            allRecs.push(book);
          }
        }
      }
      console.log('[AI-Search] Step 3c done: got', allRecs.length, 'total books from fallback');
    }

    // ========================================
    // Step 3d: Enrich books missing bookImageURL
    // ========================================
    const booksNeedingImage = allRecs.filter(b => !b.bookImageURL);
    if (booksNeedingImage.length > 0) {
      console.log('[AI-Search] Step 3d: Fetching images for', booksNeedingImage.length, 'books...');
      await Promise.all(
        booksNeedingImage.map(async (book) => {
          const isbn = book.isbn13 || book.isbn;
          if (!isbn) return;
          try {
            const res = await fetch(`https://data4library.kr/api/srchBooks?authKey=${authKey}&isbn13=${isbn}&pageNo=1&pageSize=1&format=json`);
            const data = await res.json();
            const docs = data.response?.docs || [];
            if (docs.length > 0 && docs[0].doc?.bookImageURL) {
              book.bookImageURL = docs[0].doc.bookImageURL;
            }
          } catch { /* skip */ }
        })
      );
      const enrichedCount = allRecs.filter(b => b.bookImageURL).length;
      console.log('[AI-Search] Step 3d done:', enrichedCount, '/', allRecs.length, 'books have images');
    }

    // If still nothing, return ai-only
    if (allRecs.length === 0) {
      console.log('[AI-Search] All recommendation APIs failed, returning ai-only');
      return jsonResponse({
        mode: 'ai-only',
        recommendations: aiBooks.slice(0, 10),
        seedBook: { bookname: primarySeed.bookname, authors: primarySeed.authors, isbn13: primarySeed.isbn13, bookImageURL: primarySeed.bookImageURL || '' },
        regions: []
      });
    }

    // If no GPS, return recommendations without library check
    if (isNaN(lat) || isNaN(lon)) {
      console.log('[AI-Search] No GPS, returning no-gps mode with', allRecs.length, 'recs');
      return jsonResponse({
        mode: 'no-gps',
        seedBook: { bookname: primarySeed.bookname, authors: primarySeed.authors, isbn13: primarySeed.isbn13, bookImageURL: primarySeed.bookImageURL || '' },
        recommendations: allRecs.slice(0, 10).map(book => ({ book, nearbyLibCount: 0 })),
        regions: []
      });
    }

    // ========================================
    // Step 4: Nearest regions from GPS
    // ========================================
    const nearestRegions = getNearestRegions(lat, lon, 2);
    console.log('[AI-Search] Step 4: Nearest regions:', nearestRegions.map(r => r.name).join(', '));

    // ========================================
    // Step 5: Check library availability
    // ========================================
    console.log('[AI-Search] Step 5: Checking library availability for', Math.min(allRecs.length, 15), 'books...');
    const booksToCheck = allRecs.slice(0, 15);

    const libCheckResults = await Promise.all(
      booksToCheck.map(async (book) => {
        const isbn = book.isbn13 || book.isbn;
        if (!isbn) return { book, nearbyLibCount: 0 };
        try {
          const regionResults = await Promise.all(
            nearestRegions.map(r =>
              fetch(`https://data4library.kr/api/libSrchByBook?authKey=${authKey}&isbn=${isbn}&region=${r.code}&format=json`)
                .then(res => res.json())
                .then(data => (data.response?.libs || []).length)
                .catch(() => 0)
            )
          );
          return { book, nearbyLibCount: regionResults.reduce((a, b) => a + b, 0) };
        } catch {
          return { book, nearbyLibCount: 0 };
        }
      })
    );

    // Sort: available nearby first
    libCheckResults.sort((a, b) => b.nearbyLibCount - a.nearbyLibCount);

    const availCount = libCheckResults.filter(r => r.nearbyLibCount > 0).length;
    console.log('[AI-Search] Step 5 done:', availCount, 'books available at nearby libraries');

    return jsonResponse({
      mode: 'full',
      seedBook: {
        bookname: primarySeed.bookname,
        authors: primarySeed.authors,
        isbn13: primarySeed.isbn13,
        bookImageURL: primarySeed.bookImageURL || '',
        publisher: primarySeed.publisher || '',
        publication_year: primarySeed.publication_year || ''
      },
      recommendations: libCheckResults.slice(0, 10),
      regions: nearestRegions.map(r => r.name)
    });

  } catch (error) {
    console.error('[AI-Search] Fatal error:', error);
    return jsonResponse({ error: 'AI 추천 중 오류가 발생했습니다.' }, 500);
  }
};
