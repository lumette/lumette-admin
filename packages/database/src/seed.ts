import { seedSamples } from './sync.js';
import { prisma } from './client.js';

try {
  console.log(await seedSamples());
} catch {
  console.error('샘플 seed 실패 (DB 상세 정보는 출력하지 않습니다).');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
