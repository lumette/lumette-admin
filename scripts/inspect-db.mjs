import { prisma } from '../packages/database/dist/index.js';

try {
  await prisma.$queryRaw`SELECT 1`;
  const tables =
    await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`;
  console.log(JSON.stringify({ connected: true, tables: tables.map((t) => t.tablename) }));
} catch {
  console.error('DB_READ_ONLY_CHECK_FAILED');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
