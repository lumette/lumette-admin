import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateReport } from '../apps/supplier-inspector/protocol.js';

const root = new URL('../', import.meta.url);
const receiverToken = randomBytes(32).toString('hex');
const output = new URL('.diagnostics/silvertherapy/', root);
let received = 0;
const server = createServer(async (req, res) => {
  const origin = req.headers.origin ?? '';
  const permittedOrigin = /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
  if (!permittedOrigin || req.headers.host !== '127.0.0.1:43187') {
    res.writeHead(403).end();
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.writeHead(204).end();
    return;
  }
  const supplied = req.headers.authorization ?? '';
  const expected = `Bearer ${receiverToken}`;
  if (
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    res.writeHead(401).end();
    return;
  }
  if (
    req.method !== 'POST' ||
    req.url !== '/report' ||
    !req.headers['content-type']?.startsWith('application/json')
  ) {
    res.writeHead(400).end();
    return;
  }
  if (received >= 20) {
    res.writeHead(429).end();
    return;
  }
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 512 * 1024) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    const report = JSON.parse(body);
    if (!validateReport(report)) {
      res.writeHead(422).end();
      return;
    }
    received += 1;
    const path = new URL(`${Date.now()}-${received}.json`, output);
    await writeFile(
      path,
      JSON.stringify({ receivedAt: new Date().toISOString(), ...report }, null, 2),
      { mode: 0o600, flag: 'wx' },
    );
    console.log(`진단 파일 ${received}개 수신 (상품 값은 로그에 출력하지 않음)`);
    res.writeHead(201, { 'Content-Type': 'application/json' }).end('{"saved":true}');
  } catch {
    res.writeHead(400).end();
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.on('error', () => {
  console.error('진단 서버 실행 실패. 43187 포트 사용 여부를 확인하세요.');
  process.exitCode = 1;
});
server.listen(43187, '127.0.0.1', async () => {
  try {
    await mkdir(output, { recursive: true });
    await writeFile(
      new URL('apps/supplier-inspector/local-settings.js', root),
      `export const receiverToken = ${JSON.stringify(receiverToken)};\n`,
      { mode: 0o600 },
    );
    console.log('실버테라피 진단 서버 준비: http://127.0.0.1:43187 (최대 30분 / 20회)');
    console.log(`확장 프로그램 폴더: ${fileURLToPath(new URL('apps/supplier-inspector/', root))}`);
  } catch {
    console.error('로컬 진단 설정 생성 실패');
    server.close();
    process.exitCode = 1;
  }
});
setTimeout(
  () => {
    server.closeAllConnections();
    server.close();
  },
  30 * 60 * 1000,
).unref();
