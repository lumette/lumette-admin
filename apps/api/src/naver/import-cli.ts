import { prisma } from '@lumette/database';
import { NaverCommerceError } from './client.js';
import { importStoreProducts } from './import.js';

const startedAt = new Date();

try {
  if (process.argv.slice(2).some((arg) => arg !== '--apply'))
    throw new NaverCommerceError('INVALID_ARGUMENT');
  console.log(JSON.stringify(await importStoreProducts(process.argv.includes('--apply'))));
} catch (error) {
  if (process.argv.includes('--apply')) {
    try {
      await prisma.syncHistory.create({
        data: {
          source: 'NAVER',
          status: 'FAILED',
          startedAt,
          completedAt: new Date(),
          errorCode: error instanceof NaverCommerceError ? error.code : 'DB_IMPORT_FAILED',
        },
      });
    } catch {
      console.error('실패 실행 기록도 저장하지 못했습니다. DB 연결을 확인하세요.');
    }
  }
  console.error(
    error instanceof NaverCommerceError
      ? `NAVER_IMPORT_FAILED code=${error.code} status=${error.status ?? 'none'}`
      : 'NAVER_IMPORT_FAILED: DB 저장 실패. 내부 오류와 인증정보는 출력하지 않습니다.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
