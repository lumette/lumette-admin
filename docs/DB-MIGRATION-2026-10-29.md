# production 최초 스키마 적용 결과

작업일: 2026-10-29 (한국 시간). 사용자가 테이블 생성 마이그레이션을 승인한 뒤 실행했습니다.

## 적용 결과

- 대상 프로젝트 `crimson-rain-48779096`, 기존 `production` 브랜치 하나를 유지했습니다.
- Neon CLI 읽기 전용 조회에서 production 브랜치와 read_write 엔드포인트를 확인하고, 로컬 pooled/direct 연결이 그 엔드포인트와 같은지 비밀값 출력 없이 대조했습니다.
- 최초 업무 테이블은 0개였습니다. 승인된 `20261028090000_store_supplier_options`를 적용했습니다.
- 업무 테이블 8개, `_prisma_migrations` 관리 테이블, enum 7개, 외래 키 11개 및 인덱스를 생성했습니다.
- 적용 이력: finished=true, rolled_back=false, applied_steps_count=1.
- 가격 4개 컬럼은 Decimal(18,2), 중량은 Decimal(12,4)입니다.
- 업무 테이블 8개 모두 데이터 0건입니다. 상품 삽입·샘플 seed·옵션 연결 저장·기존 데이터 삭제는 하지 않았습니다.
- 추가 브랜치·클라우드 리소스 생성, 배포, Git commit/push는 하지 않았습니다. 기존 Neon 쿼리·저장 사용량은 발생하며 요금제에 따릅니다.

## 실제 명령 및 검증

```text
node scripts/verify-schema.mjs --before
pnpm --filter @lumette/database migrate:deploy
  Applying migration `20261028090000_store_supplier_options`
  All migrations have been successfully applied.
node scripts/verify-schema.mjs
  schema: PASS
node scripts/verify-products-readonly.mjs
  POST_MIGRATION_READ_ONLY_API_CHECK: PASS (no data inserted)
pnpm build
```

Fastify `app.inject`를 사용한 실제 DB 조회 결과이며 HTTP 포트를 열어 브라우저로 확인한 결과와는 구분합니다.

후속 검증: `prisma migrate status`는 `Database schema is up to date!`, `pnpm build`는 성공(기존 Vite 번들 크기 경고 유지), API 테스트 10개와 매핑 테스트 12개 모두 통과했습니다. `pnpm format:check` 통과, `pnpm security:check`는 Git 대상 파일 80개에서 현재 검사 대상 비밀값을 발견하지 않았습니다. 새 패키지는 설치하지 않았습니다.

| 요청                            | 결과                         |
| ------------------------------- | ---------------------------- |
| GET /health                     | 200                          |
| GET /health/db                  | 200, 실제 SELECT 1 성공      |
| GET /api/products               | 200, 목록 0건                |
| GET /api/products/changes       | 200, 변경 이력 0건           |
| GET /api/dashboard              | 200, 상품/최근 변경 모두 0건 |
| 없는 상품 상세 및 옵션 미리보기 | 404                          |

검증 스크립트는 최초 스키마·빈 데이터 기준입니다. 이후 마이그레이션이나 상품 데이터가 추가되면 해당 검증의 기대값도 갱신해야 합니다. 환경변수와 연결 문자열을 출력하지 않습니다.

## 발생한 오류와 조치

1. 설치된 Neon CLI에는 `endpoints list`가 없었습니다. `neon api /projects/crimson-rain-48779096/endpoints --output json` 읽기 전용 경로로 확인했습니다.
2. 첫 migrate:deploy는 P3015로 실패했습니다. 보관된 이전 초안의 빈 `20261027090000_product_mvp` 디렉터리를 Prisma가 마이그레이션으로 인식한 것이 원인입니다. 비어 있음을 확인한 뒤 빈 디렉터리만 제거했습니다. 원본 SQL은 docs/archive에 유지했습니다. 첫 시도에서 생성된 관리 테이블의 이력은 0건, 업무 테이블은 없는 것을 재확인하고 재시도해 성공했습니다.
3. Prisma가 새 메이저 RC 버전 안내를 출력했지만 안정성 유지를 위해 기존 6.19.3을 그대로 사용했습니다.

## 남은 작업

실제 네이버 상품/옵션 최초 저장, 공급처 기준 데이터 저장과 매핑 영속화, 반복 동기화의 변경 감지·트랜잭션 검증, 정상 0건/로그인 만료 구별, 바코드 식별자 안정성, 관리자 인증 및 옵션 UI 종단 검증은 별도 작업입니다. 이번 승인을 데이터 삽입이나 외부 대량 수집 승인으로 확대하지 않았습니다.

적용한 migration.sql은 Prisma 체크섬 이력과 연결되므로 수정하지 마세요. 향후 스키마 변경은 새 마이그레이션으로 작성하고 적용 전 다시 승인받습니다.
