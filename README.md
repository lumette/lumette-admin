# Lumette Admin

루메뜨 관리자 서비스를 위한 pnpm 모노레포입니다.

## 개발 환경

모든 PC에서 아래 고정 버전을 사용하세요. `.node-version`, `.nvmrc`, `package.json`이 기준입니다.

- Node.js `24.22.1` (LTS)
- pnpm `12.15.0` (`packageManager`에 고정)
- Git

### Windows

1. [Node.js 24.22.1 LTS](https://nodejs.org/)를 설치하고 새 PowerShell 창에서 `node`, `npm`, Corepack이 동작하는지 확인합니다.
2. Corepack을 활성화하고 고정 pnpm 버전을 설치합니다.

   ```powershell
   corepack enable
   corepack prepare pnpm@12.15.0 --activate
   node --version
   pnpm --version
   ```

3. 저장소를 clone한 뒤 [최초 프로젝트 설정](#최초-프로젝트-설정)을 진행합니다.

### macOS

[nvm](https://github.com/nvm-sh/nvm)을 권장합니다. 커밋된 `.nvmrc` 파일을 읽어 프로젝트의 Node 버전을 맞춥니다.

1. nvm을 설치한 뒤 Terminal을 다시 시작합니다. 기본 셸이 zsh인 경우 nvm 설치 안내에 따라 `~/.zshrc`를 설정합니다.
2. clone한 저장소에서 고정 Node 버전을 설치·선택합니다.

   ```sh
   nvm install
   nvm use
   corepack enable
   corepack prepare pnpm@12.15.0 --activate
   node --version
   pnpm --version
   ```

3. Node `v24.22.1`, pnpm `12.15.0`이 출력되는지 확인한 뒤 [최초 프로젝트 설정](#최초-프로젝트-설정)을 진행합니다.

## 워크스페이스

- `apps/web`: Vue 3, Vite, Pinia, Element Plus
- `apps/api`: Fastify API
- `packages/shared`: 공통 TypeScript 타입
- `packages/database`: PostgreSQL / Neon용 Prisma schema

## 최초 프로젝트 설정

저장소 루트(`lumette-admin`)에서 실행합니다. Windows에서는 PowerShell, macOS에서는 Terminal을 사용하세요.

```sh
git clone https://github.com/lumette/lumette-admin.git
cd lumette-admin
pnpm install
```

커밋된 예제 파일에서 로컬 환경변수 파일을 만듭니다. PC 간 `.env` 파일을 복사하거나 Git에 커밋하지 마세요.

```sh
# macOS / Git Bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/database/.env.example packages/database/.env
```

```powershell
# Windows PowerShell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item packages/database/.env.example packages/database/.env
```

Neon DB 환경변수는 루트 `.env.local`에 저장하고 서버에서만 읽습니다. 위 DB 패키지 예제는 변수 이름 참고용이며 실제 값은 루트 `.env.local`에 설정하세요. `VITE_*` 변수에는 DB 연결 정보를 넣으면 안 됩니다.

앱을 실행합니다.

```sh
pnpm dev
```

웹은 `http://localhost:5173`, API 상태 확인 주소는 `http://localhost:3000/health`입니다.

포트가 이미 사용 중이면 기존 로컬 서버를 먼저 종료하거나, 일회성으로 다른 API 포트를 사용합니다.

```powershell
$env:PORT = '3001'; pnpm --filter @lumette/api dev
```

```sh
PORT=3001 pnpm --filter @lumette/api dev
```

## Neon 및 Prisma

Neon 접근 권한은 개발자별로 설정합니다. PC 간 인증정보를 공유하지 마세요.

1. Neon 관리가 필요할 때만 CLI를 설치합니다.

   ```sh
   npm i -g neon@latest
   neon login
   ```

2. 브라우저 인증을 완료한 후 `neon status`로 연결된 프로젝트를 확인합니다. 계획된 리소스 변경을 검토·승인하기 전에는 `neon deploy`를 실행하지 않습니다.
3. `neon deploy`는 연결 문자열을 루트 `.env.local`에 저장합니다. 이 파일은 Git에서 무시되며, `packages/database`의 Prisma 설정이 개발 환경에서만 읽습니다. 배포 환경에서는 `DATABASE_URL`과 `DATABASE_URL_UNPOOLED`을 서버 환경변수로 설정합니다. 터미널, 이슈, 로그에 출력하지 마세요.
4. 런타임 쿼리는 풀링된 `DATABASE_URL`을 사용하고, Prisma CLI 마이그레이션·관리 작업은 `DATABASE_URL_UNPOOLED`을 사용합니다.
5. 의존성 설치 또는 schema 변경 후 Prisma Client를 생성합니다.

   ```sh
   pnpm --filter @lumette/database generate
   ```

프로덕션 마이그레이션은 실행 전에 반드시 검토합니다. `production` 브랜치에는 파괴적 마이그레이션이나 테스트 테이블을 만들지 마세요.

## 명령어

```sh
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

루트 빌드는 `shared`를 API와 웹보다 먼저 빌드합니다. `allowBuilds`는 `esbuild`와 Prisma의 필수 패키지만 명시적으로 허용합니다. 새 패키지는 검토 후에만 추가하세요.

## PC 간 동기화

어느 PC에서 작업을 시작하든 최신 소스를 받고 lockfile 기준으로 정확히 설치합니다.

```sh
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
```

새 런타임, CLI, 서비스, 환경변수, 개발 명령을 추가할 때는 같은 변경에 이 README의 버전, 설치 방법, 플랫폼별 절차, 보안 주의사항도 함께 갱신합니다.

## 배포

- Vercel: `apps/web`
- Render: `apps/api`
- Neon: 로컬에서는 루트 `.env.local`, 배포 시에는 서버 환경변수의 PostgreSQL 연결 문자열

`.env` 파일, DB URL, 개인 키, 서비스 계정 JSON 파일은 절대 커밋하지 마세요.

## 상품 관리 및 변경 감지 MVP

마이그레이션 적용 전 검토 내용은 [MVP 마이그레이션 계획](docs/MVP-MIGRATION.md)에 있습니다. production DB에 적용·seed 실행하기 전 승인을 받아야 합니다.

관리자 화면은 대시보드, 상품 목록·상세, 변경 이력 탭을 제공하며 실제 API를 조회합니다. 판매 가격과 공급처 가격은 구분되고 공급처 변경이 판매 상품에 자동 반영되지는 않습니다. 가격은 DB에서 Decimal(18,2), API에서는 문자열로 전달합니다.

| API                       | 기능                             |
| ------------------------- | -------------------------------- |
| GET /health               | 서버 상태                        |
| GET /health/db            | 실제 PostgreSQL SELECT 1         |
| GET /api/dashboard        | 전체 상품 수, 최근 7일 변경 수   |
| GET /api/products?page=1  | 판매 상품 목록, 페이지당 20개    |
| GET /api/products/:id     | 상품 상세와 공급처 매핑          |
| GET /api/products/changes | 최신 변경 이력 100건과 전체 건수 |
| POST /api/suppliers/sync  | 샘플 공급처 데이터 동기화        |

샘플 동기화 body는 `{"source":"sample","scenario":"baseline"}`이며 시나리오는 `baseline → price → status → name` 순서입니다. 각 단계는 첫 샘플 상품의 가격 +500 → 품절 → 상품명 리뉴얼을 누적 적용합니다. 현재 값과 같은 시나리오를 반복하면 변경 이력은 생성하지 않습니다. 실행 기록은 변경이 없어도 남습니다.

`pnpm dev`는 실행 전에 공통 타입과 DB Client를 생성·빌드합니다. 별도 전역 패키지 추가 설치는 필요 없습니다. 환경변수는 서버 프로세스에서 다음과 같이 설정합니다 (`apps/api/.env`는 현재 자동 로드하지 않습니다).

```powershell
# Windows: 로컬 루프백에서만 샘플 동기화 허용
$env:ALLOW_SAMPLE_SYNC='true'
pnpm dev
```

```sh
# macOS
ALLOW_SAMPLE_SYNC=true pnpm dev
```

운영 환경에서는 `ALLOW_SAMPLE_SYNC`로 접근을 열 수 없습니다. 필요한 경우 서버 환경변수 `SYNC_API_TOKEN`에 충분히 긴 비밀값을 설정하고 Authorization Bearer 헤더로 전송합니다. 이 토큰은 프론트엔드 코드나 VITE 환경변수에 넣지 않습니다. 조회 API에 대한 사용자 로그인/권한 체계는 향후 구현 대상이므로 현재 MVP를 공개 관리자 서비스로 배포하지 않습니다.

검증 명령:

```sh
pnpm build
pnpm test
pnpm --filter @lumette/api test
node scripts/verify-readonly.mjs
```

`pnpm test`는 DB를 변경하지 않는 변경 감지 단위 테스트입니다. 승인 후 실행할 실제 DB 쓰기 통합 검증 절차는 마이그레이션 계획 문서를 따릅니다. 샘플 seed는 `pnpm --filter @lumette/database seed`이며 샘플 전용 SKU·공급처 식별자·isSample 표시로 운영 데이터와 구분합니다.
