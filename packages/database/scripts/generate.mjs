import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const schema = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
let current = false;
try {
  const clientRequire = createRequire(require.resolve('@prisma/client/package.json'));
  const generated = dirname(clientRequire.resolve('.prisma/client/package.json'));
  const generatedCode = readFileSync(join(generated, 'index.js'), 'utf8');
  const cliVersion = JSON.parse(
    readFileSync(require.resolve('prisma/package.json'), 'utf8'),
  ).version;
  const clientVersion = JSON.parse(
    readFileSync(require.resolve('@prisma/client/package.json'), 'utf8'),
  ).version;
  const normalize = (text) => text.replace(/\r\n/g, '\n').trim();
  current =
    cliVersion === clientVersion &&
    generatedCode.includes(`"clientVersion": "${clientVersion}"`) &&
    existsSync(join(generated, 'index.d.ts')) &&
    readdirSync(generated).some((name) => /^(?:lib)?query_engine.*\.node$/.test(name)) &&
    normalize(readFileSync(schema, 'utf8')) ===
      normalize(readFileSync(join(generated, 'schema.prisma'), 'utf8'));
} catch {
  // A clean checkout or schema/client version change always needs generation.
}
if (current) {
  console.log('Prisma Client: 현재 스키마·버전과 일치하여 재생성을 생략합니다.');
} else {
  const result = spawnSync(process.execPath, [require.resolve('prisma'), 'generate'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
}
