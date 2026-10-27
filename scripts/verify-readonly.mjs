import { createApp } from '../apps/api/dist/app.js';

const app = createApp();
try {
  for (const path of ['/health', '/health/db']) {
    const response = await app.inject({ method: 'GET', url: path });
    console.log(`${path}: ${response.statusCode} ${response.body}`);
    if (response.statusCode !== 200) process.exitCode = 1;
  }
  const denied = await app.inject({
    method: 'POST',
    url: '/api/suppliers/sync',
    payload: { source: 'sample', scenario: 'baseline' },
  });
  if (denied.statusCode !== 403) throw new Error('access restriction failed');
  console.log('인증 없는 동기화: 403 확인');
} catch {
  console.error('읽기 전용 검증 실패');
  process.exitCode = 1;
} finally {
  await app.close();
}
