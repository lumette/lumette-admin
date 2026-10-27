import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../dist/app.js';
import { prisma } from '@lumette/database';

test('운영 환경에서는 루프백과 개발 허용 플래그로 인증을 우회할 수 없다', async () => {
  const saved = {
    node: process.env.NODE_ENV,
    allow: process.env.ALLOW_SAMPLE_SYNC,
    token: process.env.SYNC_API_TOKEN,
  };
  process.env.NODE_ENV = 'production';
  process.env.ALLOW_SAMPLE_SYNC = 'true';
  delete process.env.SYNC_API_TOKEN;
  const app = createApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/suppliers/sync',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      payload: { source: 'sample', scenario: 'baseline' },
    });
    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
    for (const [key, value] of [
      ['NODE_ENV', saved.node],
      ['ALLOW_SAMPLE_SYNC', saved.allow],
      ['SYNC_API_TOKEN', saved.token],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('DB 오류 응답은 연결 정보와 내부 오류를 노출하지 않는다', async () => {
  const original = prisma.$queryRaw;
  prisma.$queryRaw = async () => {
    throw new Error('PRIVATE_INTERNAL_ERROR');
  };
  const app = createApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/health/db' });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: 'error', database: 'unavailable' });
  } finally {
    prisma.$queryRaw = original;
    await app.close();
  }
});
