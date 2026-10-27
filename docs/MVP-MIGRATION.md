# 상품 관리 MVP 마이그레이션 승인 계획

대상: 기존 Neon `production` 브랜치의 `public` 스키마. 추가 Neon 리소스는 생성하지 않습니다.

## 생성할 테이블

| 테이블           | 역할                    | 주요 제약                                      |
| ---------------- | ----------------------- | ---------------------------------------------- |
| Product          | 판매 상품               | sku 고유, 가격 Decimal(18,2), 샘플 표시        |
| SupplierProduct  | 공급처 원본             | supplier + externalId 고유, 가격 Decimal(18,2) |
| ProductMapping   | 판매 상품과 공급처 매핑 | productId + supplierProductId 고유             |
| ProductChangeLog | 가격·상태·상품명 변경   | 동기화 실행 + 공급처 상품 + 항목 고유          |
| SyncHistory      | 샘플 동기화 실행 결과   | 처리 수·변경 수·실패 코드·시작/완료 시각       |

상태 enum 3개와 조회용 인덱스, 외래 키를 생성합니다. 관계 삭제는 RESTRICT로 보호합니다.
Prisma Migrate는 `_prisma_migrations` 관리 테이블도 생성합니다.
SQL은 `packages/database/prisma/migrations/20261027090000_product_mvp/migration.sql`에서 확인할 수 있습니다.
DDL 전체를 트랜잭션으로 묶었으며 DROP, TRUNCATE, 기존 데이터 DELETE/UPDATE는 없습니다.

## 승인 후 실행 순서

1. DB 테이블 상태를 다시 읽기 전용 점검합니다. 검토한 빈 스키마와 달라졌으면 적용 전 재검토합니다.
2. `pnpm --filter @lumette/database migrate:deploy`
3. `pnpm --filter @lumette/database seed` — 샘플 판매 상품 6개, 공급처 상품 6개, 매핑 6개. 반복 seed는 기존 값을 덮어쓰지 않습니다.
4. PowerShell: `$env:CONFIRM_SAMPLE_WRITES='true'; node scripts/verify-mvp.mjs`
5. macOS: `CONFIRM_SAMPLE_WRITES=true node scripts/verify-mvp.mjs`
6. Vue 화면에서 실제 API 응답을 확인합니다.

통합 검증은 예약된 `lumette-sample` 공급처의 첫 샘플 상품만 순서대로 가격 +500, 품절, 이름 리뉴얼 상태로 바꾸며 샘플 변경 이력과 실행 기록을 남깁니다. 반복 검증은 이 샘플만 baseline으로 돌린 뒤 재진행합니다. 운영 상품을 변경하거나 샘플 이력을 삭제하지 않습니다.

## 비용과 적용 범위

새 브랜치/compute/서비스는 없습니다. 기존 DB의 테이블·인덱스·샘플 데이터가 소량의 저장소와 쿼리 사용량을 소비합니다. 무료 한도 내 비용을 보장하는 것은 아니며 계정 사용량을 따릅니다.
승인 전에는 migrate:deploy, seed, verify-mvp를 실행하지 않습니다.
