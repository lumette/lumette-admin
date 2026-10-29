# 네이버 커머스 API 읽기 전용 연결 준비

목적은 내 스마트스토어에 등록된 상품만 실버테라피 조회 대상으로 삼기 위해 실제 상품 품번·옵션 응답을 확인하는 것입니다. 서버용 읽기 전용 클라이언트와 진단 명령을 구현했으며, 2026-10-28에 실제 인증·상품 조회가 성공했습니다.

## 실제 확인 결과 (2026-10-28)

- 실제 OAuth 토큰 발급 및 상품 목록 조회 성공. 토큰·서명·시크릿은 로그/파일에 저장하지 않음.
- API 목록 응답 totalElements 8, 첫 페이지 상품 8개, 원상품 상세 8개를 순차 조회함.
- 품번 원본은 `originProduct.detailAttribute.manufactureDefineNo`. `naverShoppingSearchInfo` 안의 값이 아니었으며 판매자 관리 코드는 비어 있었음.
- 실제 품번 예: `B260128005`. 앞서 사용자가 제공한 거래처 테스트 코드 `R221057427`은 이 조회 결과에서 일치하지 않았음. 상품명이나 다른 코드를 임의 대입해 매핑하지 않음.
- 조합형 옵션은 `originProduct.detailAttribute.optionInfo.optionCombinations`에서 id, optionName1/2/3, price, stockQuantity, usable을 확인함. 조회된 옵션 그룹에는 `size`가 있었음. 사용자가 이후 사이즈 옵션만 있으면 Silver라는 공통 업무 규칙을 확정함. 이 규칙의 코드/DB 적용은 아직 전이며, 다른 옵션 유형까지 정규화한 것은 아님.
- 품번 중 E로 시작하는 귀걸이도 있었음. 현재 합의한 B/R/N 분류 밖이므로 미지원 분류로 표시해야 하며 품절로 처리하면 안 됨.
- 원본 상세 HTML 및 배송/연락처 필드는 저장하지 않고, 상품/옵션 필드만 `.diagnostics/naver/products-readonly.json`에 보관함. Git 제외 대상.
- 상품 등록·수정, 실버테라피 자동 조회, DB 쓰기·마이그레이션은 하지 않음.

## 설치 및 실행 (Windows / macOS 공통)

추가 의존성은 `apps/api`의 `bcryptjs@3.0.3`(bcrypt 서명)와 `dotenv`(루트 `.env.local` 로딩)입니다. 전역 설치는 필요 없습니다.

```sh
pnpm install --frozen-lockfile
pnpm naver:check
```

`pnpm naver:check`는 API를 빌드한 뒤 읽기 전용 진단 명령을 실행합니다. 환경변수가 없으면 안전한 오류 코드로 중단합니다. 목록 첫 페이지와 품번 검색, 최대 8개 원상품 상세만 조회하며 모든 호출에 타임아웃을 적용합니다. 상세는 순차 조회하고 호출 사이에 지연을 둡니다. 이 명령은 아직 관리자 화면의 연결 버튼이나 인증된 공개 REST API가 아닙니다.

`pnpm --filter @lumette/api test`는 공식 고정 서명 예제와 합성 API 응답으로 토큰 캐시, 인증 만료 1회 재시도, IP 오류 보호를 검증합니다. 실제 API 검증과 별도입니다.

## 사용자가 준비할 항목

1. [네이버 커머스API센터](https://apicenter.commerce.naver.com/)에서 본인 스토어에 접근할 수 있는 애플리케이션 등록/사용 권한을 확인합니다. 네이버 로그인 일반 API나 쇼핑 검색 API와는 다릅니다.
2. 애플리케이션 ID와 애플리케이션 시크릿을 발급받습니다. 발급값은 채팅·스크린샷에 포함하지 않습니다.
3. 등록한 애플리케이션의 자체 사용/판매자 연동 유형과 상품 API 사용 권한, 호출 IP 설정을 확인합니다. IP 제한을 사용한다면 회사 PC·개인 Mac·배포 서버의 외부 요청 IP는 서로 다를 수 있습니다.
4. 이 저장소 루트 `.env.example`의 빈 항목을 참고해 루트 `.env.local`에 네이버 항목만 직접 추가합니다. 기존 Neon 값은 유지합니다. 자체 리소스는 SELF, 관련 판매자 리소스 접근은 SELLER이며 후자는 account_id가 필요합니다. 실제 애플리케이션 유형을 확인한 뒤 선택합니다.
5. 실제 시크릿 대신 “앱 등록 완료 / 환경변수 설정 완료” 여부만 알려줍니다.

애플리케이션 시크릿, 토큰, 전자서명은 서버에서만 다룹니다. 프론트엔드 또는 실버테라피 확장 프로그램에 전달하지 않습니다. 별도 클라우드 리소스는 추가하지 않습니다.

## 연결 시 구현·검증할 범위

- 서버 간 Client Credentials 인증. client_id와 timestamp를 연결한 문자열에 client_secret을 salt로 bcrypt 서명하고 Base64 인코딩합니다. 토큰과 서명은 로그에 남기지 않습니다.
- `POST /v1/products/search`: 상품 목록 조회입니다. HTTP POST이지만 상품 생성 API가 아닙니다. 페이지별로 내 상품을 읽습니다.
- `GET /v2/products/origin-products/:originProductNo`: 실제 원상품·옵션 정보를 읽습니다. 실제 목록에 존재하는 원상품번호만 대상으로 조회합니다.
- 상품 등록·수정·가격 변경·품절 처리 API는 이 연결 검증에서 호출하지 않습니다.
- 목록의 sellerManagementCode, 상세의 detailAttribute.sellerCodeInfo.sellerManagementCode, detailAttribute.manufactureDefineNo 등 실제 필드를 대조합니다. 이 스토어의 품번 원본은 위 검증 결과의 manufactureDefineNo입니다. 상품명에서 임의로 품번을 추측하지 않습니다.
- 옵션 ID, 옵션 그룹명, 조합 값, 가격 및 사용 여부를 실제 응답으로 확인합니다. 네이버 옵션명이 Silver/Gold/Rose Gold와 동일하다고 가정하지 않습니다.
- 401 인증 만료, 403 권한 오류, 429 호출 제한, 네트워크 오류를 상품 품절로 처리하지 않습니다.
- 실버테라피 상품 코드 및 옵션 구조와 실제 네이버 응답이 확인된 후 스키마를 확정합니다. DB 마이그레이션은 별도 승인 후 적용합니다.

## 확인한 공식 문서

- [커머스 API 소개](https://apicenter.commerce.naver.com/docs/introduction)
- [서버 인증·전자서명](https://apicenter.commerce.naver.com/docs/auth)
- [토큰 요청 타입과 account_id](https://apicenter.commerce.naver.com/docs/commerce-api/current/exchange-sellers-auth)
- [상품 목록 조회](https://apicenter.commerce.naver.com/docs/commerce-api/current/search-product)
- [원상품 조회](https://apicenter.commerce.naver.com/docs/commerce-api/current/read-origin-product-product)

문서의 응답 예시를 실제 스토어 데이터로 간주하지 않습니다. 네이버 인증·상품/조합형 옵션 조회는 실제 성공했고, 거래처 상품·옵션 자동 매핑과 DB 저장은 아직 미검증입니다.
