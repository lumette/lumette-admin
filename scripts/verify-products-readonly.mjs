import assert from 'node:assert/strict';
import { createApp } from '../apps/api/dist/app.js';

const app = createApp();
try {
  for (const path of [
    '/health',
    '/health/db',
    '/api/products',
    '/api/products/changes',
    '/api/dashboard',
  ]) {
    const response = await app.inject({ method: 'GET', url: path });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    if (path === '/health/db') assert.equal(body.database, 'connected');
    if (Array.isArray(body.items)) {
      assert.equal(body.items.length, 0);
      assert.equal(body.total, 0);
    }
    if (path === '/api/dashboard') {
      assert.equal(body.productCount, 0);
      assert.equal(body.recentChangeCount, 0);
    }
    console.log(
      JSON.stringify({
        path,
        status: response.statusCode,
        ...(Array.isArray(body.items) ? { count: body.items.length } : {}),
      }),
    );
  }
  for (const path of [
    '/api/products/migration-check-missing',
    '/api/products/migration-check-missing/options/preview',
  ]) {
    const response = await app.inject({ method: 'GET', url: path });
    assert.equal(response.statusCode, 404);
    console.log(JSON.stringify({ path, status: response.statusCode }));
  }
  console.log('POST_MIGRATION_READ_ONLY_API_CHECK: PASS (no data inserted)');
} catch {
  console.error('POST_MIGRATION_API_CHECK_FAILED: 내부 오류와 연결 정보는 출력하지 않습니다.');
  process.exitCode = 1;
} finally {
  await app.close();
}
