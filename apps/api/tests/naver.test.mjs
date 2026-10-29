import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NaverReadClient, createSignature, credentialsFromEnv } from '../dist/naver/client.js';

// Public documentation fixture, never a real application credential.
const credentials = {
  clientId: 'aaaabbbbcccc',
  clientSecret: '$2a$10$abcdefghijklmnopqrstuv',
  type: 'SELF',
};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('네이버 공식 고정 예제의 bcrypt + Base64 서명과 일치', async () => {
  assert.equal(
    await createSignature(credentials.clientId, credentials.clientSecret, 1643961623299),
    'JDJhJDEwJGFiY2RlZmdoaWprbG1ub3BxcnN0dXVCVldZSk42T0VPdEx1OFY0cDQxa2IuTnpVaUEzbmsy',
  );
});
test('읽기 요청 허용 경로와 토큰 캐시 (합성 응답)', async () => {
  const calls = [];
  const client = new NaverReadClient(credentials, async (url, init) => {
    calls.push([url, init.method]);
    return url.endsWith('/oauth2/token')
      ? json({ access_token: 'synthetic-token', expires_in: 10800 })
      : json({ contents: [] });
  });
  await client.listProducts();
  await client.listProducts(2);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(([url]) => /\/v1\/(oauth2\/token|products\/search)$/.test(url)));
  assert.throws(() => client.getOriginProduct('../other'), { code: 'INVALID_PRODUCT_ID' });
});
test('GW.AUTHN 응답에만 토큰 재발급 후 한 번 재시도', async () => {
  let tokens = 0;
  let reads = 0;
  const client = new NaverReadClient(credentials, async (url) => {
    if (url.endsWith('/oauth2/token')) {
      tokens += 1;
      return json({ access_token: 'synthetic-token', expires_in: 10800 });
    }
    reads += 1;
    return reads === 1 ? json({ code: 'GW.AUTHN' }, 401) : json({ contents: [] });
  });
  await client.listProducts();
  assert.equal(tokens, 2);
  assert.equal(reads, 2);
});
test('IP 제한은 재시도/품절 판정 없이 종료하고 응답의 비밀값을 숨긴다', async () => {
  const client = new NaverReadClient(credentials, async () =>
    json({ code: 'GW.IP_NOT_ALLOWED', message: 'synthetic-private-value' }, 403),
  );
  await assert.rejects(
    client.listProducts(),
    (error) =>
      error.code === 'GW.IP_NOT_ALLOWED' &&
      error.status === 403 &&
      !error.message.includes('synthetic-private-value'),
  );
});
test('SELLER 유형은 account id가 있어야 한다', () => {
  assert.throws(
    () =>
      credentialsFromEnv({
        NAVER_CLIENT_ID: 'fixture',
        NAVER_CLIENT_SECRET: 'fixture',
        NAVER_AUTH_TYPE: 'SELLER',
      }),
    { code: 'MISSING_CONFIGURATION' },
  );
});
