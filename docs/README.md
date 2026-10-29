# 루메뜨 개발 문서

현재 최신 작업: [실제 스마트스토어 상품 바인딩](PRODUCT-BINDING.md). 2026-10-29 상품 8개·옵션 16개를 저장하고 DB/API 조회를 검증했습니다. 공급처 실제 연결은 별도 검증이 남아 있습니다.

현재 상태를 파악할 때에는 [프로젝트 현황 및 합의된 요구사항](LUMETTE-PROJECT-STATUS.md)을 먼저 읽으세요.

최신 결과: [2026-10-29 production 스키마 적용 보고](DB-MIGRATION-2026-10-29.md). 테이블 생성과 빈 데이터 조회를 검증했으며 실제 상품/옵션 저장은 아직 하지 않았습니다.

설계 상세: [상품·옵션 스키마와 매핑](SCHEMA-OPTION-MAPPING.md).

| 문서                                                   | 내용                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| [LUMETTE-PROJECT-STATUS.md](LUMETTE-PROJECT-STATUS.md) | 전체 현황, 사용자 확정 규칙, 실제 관측, 미검증 항목, 다음 작업          |
| [SILVERTHERAPY-RESEARCH.md](SILVERTHERAPY-RESEARCH.md) | 실제 검색·상품·옵션 HTML 필드 관측                                      |
| [NAVER-COMMERCE-SETUP.md](NAVER-COMMERCE-SETUP.md)     | 네이버 인증 준비, 읽기 전용 연결, 실제 조회 결과                        |
| [진단 확장 안내](../apps/supplier-inspector/README.md) | Windows/macOS Chrome 설치·전송 절차                                     |
| [MVP-MIGRATION.md](MVP-MIGRATION.md)                   | 이전 샘플 모델의 미적용 SQL 계획. 현재 실연동 설계가 아니므로 실행 금지 |

비밀번호, 세션, API 시크릿, 실제 DB 연결 문자열은 문서에 기록하지 않습니다. 확인된 사실·사용자 업무 규칙·구현 계획·테스트 결과를 구분하고, 변경되는 설치 및 운영 절차도 함께 갱신합니다.
