# library-insights

Astro 기반 도서 검색/추천 웹앱입니다. Cloudflare Pages(Functions) 환경을 기준으로 동작하며, Supabase 인증/데이터와 외부 도서 API, OpenAI 기반 기능을 포함합니다.

## Tech Stack
- Astro 5
- Tailwind CSS
- Cloudflare Pages + Wrangler
- Supabase (`@supabase/supabase-js`)
- OpenAI SDK

## Prerequisites
- Node.js 18+
- npm
- Cloudflare account (Pages 배포 시)
- Supabase project (인증/프로필/북마크 기능 사용 시)

## Install
```bash
npm install
```

## Run
```bash
npm run dev
```

Cloudflare Pages 런타임 기준으로 확인하려면:
```bash
npm run dev:cf
```

## Build / Preview
```bash
npm run build
npm run preview
```

Cloudflare Pages 미리보기:
```bash
npm run preview:cf
```

## Environment Variables
로컬 개발 시 `.env` 또는 `.dev.vars`를 사용합니다.

주요 키 예시:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `OPENAI_API_KEY`
- `DATA4LIBRARY_API_KEY`
- `SEOUL_OPENDATA_API_KEY`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`

`.dev.vars.example`를 참고해 필요한 키를 채운 뒤 실행하세요.

## Project Structure
```text
src/
  components/         UI 컴포넌트
  lib/                공용 유틸/클라이언트 (예: supabase)
  pages/              Astro 페이지
  pages/api/          API 라우트
  scripts/            클라이언트 스크립트
public/               정적 리소스
```

## Deployment
Cloudflare Pages 설정 파일은 `wrangler.toml`에 있습니다.
기본 빌드 산출물은 `dist/`입니다.

## Notes
- 민감 정보는 Git에 커밋하지 말고 `.env`, `.dev.vars`로 관리하세요.
- 현재 설정은 서버 출력(`output: "server"`) + Cloudflare 어댑터 기준입니다.