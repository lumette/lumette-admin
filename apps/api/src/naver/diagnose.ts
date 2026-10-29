import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { NaverReadClient, NaverCommerceError, credentialsFromEnv, object } from './client.js';

const root = new URL('../../../../', import.meta.url);
config({ path: fileURLToPath(new URL('.env.local', root)), quiet: true });
const scalar = (value: unknown): string | null => {
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return null;
};
const optionalObject = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? object(value) : {};

// Evidence only: never infer a mapping from a code appearing inside HTML.
function codeEvidence(value: unknown, path = '', depth = 0): { path: string; codes: string[] }[] {
  if (depth > 12) return [];
  if (typeof value === 'string') {
    const codes = [...new Set(value.match(/(?<![A-Z0-9])[BRN]\d{9}(?!\d)/g) ?? [])];
    return codes.length ? [{ path, codes: codes.slice(0, 20) }] : [];
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value)
    .flatMap(([key, entry]) => codeEvidence(entry, path ? `${path}.${key}` : key, depth + 1))
    .slice(0, 50);
}

async function main() {
  const client = new NaverReadClient(credentialsFromEnv());
  const target = 'R221057427';
  const page = await client.listProducts();
  console.log('PASS: 네이버 인증 및 상품 목록 조회 (읽기 전용)');
  const contents = page.contents as unknown[];
  const summaries = contents.map((value) => {
    const row = object(value);
    const channels = Array.isArray(row.channelProducts)
      ? row.channelProducts.map((entry) => {
          const channel = object(entry);
          return {
            channelProductNo: scalar(channel.channelProductNo),
            sellerManagementCode: scalar(channel.sellerManagementCode),
            name: scalar(channel.name),
            statusType: scalar(channel.statusType),
            channelServiceType: scalar(channel.channelServiceType),
          };
        })
      : [];
    return { originProductNo: scalar(row.originProductNo), channels };
  });
  // One targeted search if the first page does not identify the supplied SKU.
  let candidates = summaries.filter((item) =>
    item.channels.some((channel) => channel.sellerManagementCode === target),
  );
  if (!candidates.length) {
    await pause(600);
    const search = await client.listProducts(1, 20, target);
    candidates = (search.contents as unknown[]).map((value) => ({
      originProductNo: scalar(object(value).originProductNo),
      channels: [],
    }));
  }
  // Inspect at most eight own-store products, with delays, to identify the
  // actual SKU field. Never crawl the supplier catalogue.
  const ids = [
    ...new Set(
      (candidates.length ? candidates : summaries)
        .map((item) => item.originProductNo)
        .filter((id): id is string => Boolean(id)),
    ),
  ].slice(0, 8);
  const details = [];
  for (const id of ids) {
    await pause(600);
    const response = await client.getOriginProduct(id);
    const product = object(response.originProduct);
    const attribute = optionalObject(product.detailAttribute);
    const codes = optionalObject(attribute.sellerCodeInfo);
    const shopping = optionalObject(attribute.naverShoppingSearchInfo);
    const optionInfo = optionalObject(attribute.optionInfo);
    const optionRows = Array.isArray(optionInfo.optionCombinations)
      ? optionInfo.optionCombinations.map((value) => {
          const option = object(value);
          return {
            id: scalar(option.id),
            optionName1: scalar(option.optionName1),
            optionName2: scalar(option.optionName2),
            optionName3: scalar(option.optionName3),
            sellerManagerCode: scalar(option.sellerManagerCode),
            price: scalar(option.price),
            stockQuantity: scalar(option.stockQuantity),
            usable: option.usable === true,
          };
        })
      : [];
    details.push({
      originProductNo: id,
      name: scalar(product.name),
      statusType: scalar(product.statusType),
      salePrice: scalar(product.salePrice),
      sellerManagementCode: scalar(codes.sellerManagementCode),
      manufactureDefineNo: scalar(attribute.manufactureDefineNo ?? shopping.manufactureDefineNo),
      codeEvidence: codeEvidence(product, 'originProduct'),
      optionInfoKeys: Object.keys(optionInfo),
      optionCombinationGroupNames: optionalObject(optionInfo.optionCombinationGroupNames),
      options: optionRows,
    });
    if (
      codes.sellerManagementCode === target ||
      attribute.manufactureDefineNo === target ||
      shopping.manufactureDefineNo === target
    )
      break;
  }
  const directory = new URL('.diagnostics/naver/', root);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL('products-readonly.json', directory),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        target,
        totalElements: scalar(page.totalElements),
        firstPageCount: contents.length,
        summaries,
        details,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `PASS: 상품 목록 ${contents.length}개 / 상세 ${details.length}개 확인. 상품 필드만 Git 제외 진단 파일에 저장.`,
  );
  const matched = details.find(
    (item) => item.sellerManagementCode === target || item.manufactureDefineNo === target,
  );
  console.log(
    matched
      ? `PASS: 대상 품번 실제 필드 확인 / 조합형 옵션 ${matched.options.length}개`
      : '미검증: 제한된 조회 범위에서 대상 품번의 상세 연결을 확인하지 못했습니다.',
  );
}

main().catch((error: unknown) => {
  if (error instanceof NaverCommerceError)
    console.error(`NAVER_CHECK_FAILED code=${error.code} status=${error.status ?? 'none'}`);
  else console.error('NAVER_CHECK_FAILED (내부 응답 및 인증정보 출력 생략)');
  process.exitCode = 1;
});
