import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { parse } = require('dotenv');
try {
  const secrets = [];
  for (const file of ['.env', '.env.local']) {
    try {
      for (const [key, value] of Object.entries(parse(readFileSync(join(root, file))))) {
        if (/PASSWORD|SECRET|TOKEN|DATABASE_URL|API_KEY/i.test(key) && value.length >= 8) {
          secrets.push(value);
          if (key.startsWith('DATABASE_URL')) {
            try {
              const password = decodeURIComponent(new URL(value).password);
              if (password.length >= 8) secrets.push(password);
            } catch {
              /* not a URL */
            }
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const files = execFileSync(
    'git',
    [
      '-c',
      `safe.directory=${root.replace(/\\/g, '/')}`,
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
    ],
    { cwd: root, encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean);
  const findings = [];
  for (const file of new Set(files)) {
    try {
      const content = readFileSync(join(root, file), 'utf8');
      if (content.includes('\0')) continue;
      if (/^\.env(?:\.|$)/.test(file) && file !== '.env.example') findings.push(file);
      if (secrets.some((value) => content.includes(value))) findings.push(file);
      if (
        /(?:postgres(?:ql)?:\/\/)[^\s"'<>]+:[^\s"'<>]+@/i.test(content) &&
        !/USER:PASSWORD@HOST/.test(content)
      )
        findings.push(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (findings.length) {
    console.error(JSON.stringify({ status: 'REVIEW_REQUIRED', files: [...new Set(findings)] }));
    process.exitCode = 1;
  } else
    console.log(
      JSON.stringify({
        status: 'PASS',
        scannedFiles: new Set(files).size,
        note: '현재 작업 트리만 검사했습니다. Git 이력과 알 수 없는 비밀값 형식은 보장하지 않습니다.',
      }),
    );
} catch {
  console.error('SECRET_CHECK_FAILED: 검사 자체가 완료되지 않았습니다.');
  process.exitCode = 1;
}
