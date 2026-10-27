// Only run after approval to apply the migration and write sample data.
import assert from 'node:assert/strict';
import { createApp } from '../apps/api/dist/app.js';
import { prisma, seedSamples } from '../packages/database/dist/index.js';

if (process.env.CONFIRM_SAMPLE_WRITES !== 'true') {
  throw new Error('승인 후 CONFIRM_SAMPLE_WRITES=true를 설정하세요.');
}
process.env.ALLOW_SAMPLE_SYNC = 'true';
const app = createApp();
try {
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const get = async (path) => {
    const response = await fetch(`${address}${path}`);
    assert.equal(response.status, 200);
    return response.json();
  };
  await seedSamples();
  await seedSamples();
  assert.equal(
    await prisma.product.count({
      where: { isSample: true, sku: { startsWith: 'LUMETTE-SAMPLE-' } },
    }),
    6,
  );
  console.log('PASS: seed 재실행 후 샘플 판매 상품 6개');
  const sync = async (scenario) => {
    const response = await fetch(`${address}/api/suppliers/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SYNC_API_TOKEN
          ? { Authorization: `Bearer ${process.env.SYNC_API_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ source: 'sample', scenario }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  // On repeat runs, return only the reserved sample namespace to baseline.
  await sync('baseline');
  assert.equal((await sync('baseline')).changeCount, 0);
  console.log('PASS: 동일 데이터 재동기화 이력 0건');
  for (const [scenario, field] of [
    ['price', 'PRICE'],
    ['status', 'STATUS'],
    ['name', 'NAME'],
  ]) {
    const result = await sync(scenario);
    assert.equal(result.changeCount, 1);
    const logs = await prisma.productChangeLog.findMany({ where: { syncHistoryId: result.id } });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].field, field);
    assert.equal((await sync(scenario)).changeCount, 0);
    console.log(`PASS: ${field} 이력 1건 및 재시도 0건`);
  }
  const concurrent = await Promise.all([sync('name'), sync('name')]);
  assert.equal(
    concurrent.reduce((sum, result) => sum + result.changeCount, 0),
    0,
  );
  const products = await get('/api/products');
  assert.ok(products.items.length >= 6);
  assert.equal(typeof products.items[0].price, 'string');
  await get(`/api/products/${products.items[0].id}`);
  await get('/api/products/changes');
  await get('/api/dashboard');
  await get('/health');
  await get('/health/db');
  assert.equal((await fetch(`${address}/api/products/nonexistent`)).status, 404);
  console.log('PASS: 실제 HTTP 상품 목록·상세·변경 이력·대시보드·health·DB 쿼리');
} catch {
  console.error('MVP 통합 검증 실패 (인증정보 출력 생략)');
  process.exitCode = 1;
} finally {
  await app.close();
  await prisma.$disconnect();
}
