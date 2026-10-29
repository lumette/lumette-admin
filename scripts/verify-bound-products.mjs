import assert from 'node:assert/strict';
import { prisma } from '../packages/database/dist/index.js';
import { createApp } from '../apps/api/dist/app.js';

const app = createApp();
async function read(path) {
  if (!process.argv.includes('--http')) return app.inject({ method: 'GET', url: path });
  const response = await fetch(`http://localhost:3000${path}`, {
    headers: { Origin: 'http://localhost:5173' },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const body = await response.json();
  return { statusCode: response.status, json: () => body };
}
try {
  const storeKey = process.env.NAVER_STORE_KEY ?? 'lumette';
  const saved = await prisma.storeProduct.findMany({
    where: { storeKey },
    include: { options: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
  assert.ok(saved.length > 0 && saved.length <= 100);
  const list = await read('/api/products');
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().total, saved.length);
  assert.deepEqual(
    list.json().items.map((item) => item.id),
    saved.slice(0, 20).map((item) => item.id),
  );
  let options = 0;
  for (const product of saved) {
    const response = await read(`/api/products/${product.id}`);
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.name, product.name);
    assert.equal(body.sku, product.manufactureDefineNo);
    assert.equal(body.price, product.salePrice.toString());
    assert.equal(body.options.length, product.options.length);
    for (const option of product.options) {
      const dto = body.options.find((item) => item.naverOptionId === option.naverOptionId);
      assert.ok(dto);
      assert.equal(dto.priceAdjustment, option.priceAdjustment.toString());
      assert.equal(dto.stockQuantity, option.stockQuantity);
      assert.equal(dto.rawName, option.rawName);
    }
    options += product.options.length;
    const preview = await read(`/api/products/${product.id}/options/preview`);
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.json().reason, 'ACTIVE_PRODUCT_MAPPING_REQUIRED');
  }
  const dashboard = await read('/api/dashboard');
  assert.equal(dashboard.statusCode, 200);
  assert.equal(dashboard.json().productCount, saved.length);
  const changes = await read('/api/products/changes');
  assert.equal(changes.statusCode, 200);
  assert.equal(changes.json().total, 0);
  const histories = await prisma.syncHistory.count({
    where: { source: 'NAVER', status: 'SUCCESS' },
  });
  if (process.argv.includes('--http')) {
    const page = await fetch('http://localhost:5173', { signal: AbortSignal.timeout(15000) });
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes('id="app"'));
    console.log('LIVE_HTTP_AND_VITE_ENTRY: PASS (브라우저 DOM 검증과는 별개)');
  }
  console.log(
    JSON.stringify({
      status: 'PASS',
      products: saved.length,
      options,
      successfulNaverImports: histories,
      supplierMappings: 'PENDING_VERIFIED_COLLECTION',
      changes: 0,
    }),
  );
} catch {
  console.error('BOUND_PRODUCTS_CHECK_FAILED: 비밀값과 내부 오류는 출력하지 않습니다.');
  process.exitCode = 1;
} finally {
  await app.close();
}
