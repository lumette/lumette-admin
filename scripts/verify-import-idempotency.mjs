import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../packages/database/dist/index.js';
import { fetchStoreProducts, persistStoreProducts } from '../apps/api/dist/naver/import.js';
import { NaverReadClient, credentialsFromEnv } from '../apps/api/dist/naver/client.js';

const storeKey = process.env.NAVER_STORE_KEY ?? 'lumette';
async function timestamps() {
  const [products, options] = await prisma.$transaction([
    prisma.storeProduct.findMany({
      where: { storeKey },
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
    }),
    prisma.storeProductOption.findMany({
      where: { storeProduct: { storeKey } },
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  return JSON.stringify({ products, options });
}
try {
  const products = await fetchStoreProducts(new NaverReadClient(credentialsFromEnv()));
  const before = await timestamps();
  const requestKey = randomUUID();
  const result = await persistStoreProducts(storeKey, products, requestKey);
  for (const field of [
    'productsCreated',
    'productsUpdated',
    'optionsCreated',
    'optionsUpdated',
    'optionsDeactivated',
  ])
    assert.equal(result[field], 0);
  assert.equal(await timestamps(), before);
  const histories = await prisma.syncHistory.count({ where: { source: 'NAVER' } });
  const replay = await persistStoreProducts(storeKey, products, requestKey);
  assert.equal(replay.replay, true);
  assert.equal(await prisma.syncHistory.count({ where: { source: 'NAVER' } }), histories);
  assert.equal(await timestamps(), before);
  console.log(
    JSON.stringify({
      status: 'PASS',
      processed: products.length,
      productAndOptionWrites: 0,
      timestampsUnchanged: true,
      requestReplayDeduplicated: true,
      note: '정상 실행 기록 1건만 추가, 같은 요청 키 재실행은 기록도 추가하지 않음',
    }),
  );
} catch {
  console.error(
    'IMPORT_IDEMPOTENCY_CHECK_FAILED: 외부 상품 변경·정규화·DB 상태를 확인하세요. 비밀값 출력 없음.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
