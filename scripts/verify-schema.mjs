import assert from 'node:assert/strict';
import { prisma } from '../packages/database/dist/index.js';

const models = [
  'storeProduct',
  'storeProductOption',
  'supplierProduct',
  'supplierProductOption',
  'productMapping',
  'optionMapping',
  'productChangeLog',
  'syncHistory',
];
const tables = [
  'StoreProduct',
  'StoreProductOption',
  'SupplierProduct',
  'SupplierProductOption',
  'ProductMapping',
  'OptionMapping',
  'ProductChangeLog',
  'SyncHistory',
];
try {
  const urls = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'].map(
    (key) => new URL(process.env[key] ?? ''),
  );
  for (const url of urls) {
    assert.ok(url.hostname.endsWith('.neon.tech'));
    assert.equal(
      url.hostname.split('.')[0].replace(/-pooler$/, ''),
      'ep-solitary-firefly-ao8crcjr',
    );
  }
  assert.equal(urls[0].pathname, urls[1].pathname);
  assert.equal(urls[0].username, urls[1].username);
  console.log(
    JSON.stringify({
      target: 'production',
      project: 'crimson-rain-48779096',
      connectionTargetMatches: true,
    }),
  );
  await prisma.$queryRaw`SELECT 1`;
  const existing =
    await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  if (process.argv.includes('--before')) {
    assert.ok(existing.every((row) => row.tablename === '_prisma_migrations'));
    if (existing.length) {
      const history =
        await prisma.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations"`;
      assert.equal(history[0].count, 0);
    }
    console.log(
      JSON.stringify({
        preflight: 'PASS',
        existingTables: existing.map((row) => row.tablename),
        appliedMigrations: 0,
      }),
    );
  } else {
    assert.deepEqual(
      existing.map((row) => row.tablename).sort(),
      [...tables, '_prisma_migrations'].sort(),
    );
    const migrations =
      await prisma.$queryRaw`SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count FROM "_prisma_migrations"`;
    assert.equal(migrations.length, 1);
    assert.equal(migrations[0].migration_name, '20261028090000_store_supplier_options');
    assert.equal(migrations[0].finished, true);
    assert.equal(migrations[0].rolled_back, false);
    assert.ok(migrations[0].applied_steps_count > 0);
    const decimals =
      await prisma.$queryRaw`SELECT table_name, column_name, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'numeric' ORDER BY table_name, column_name`;
    assert.equal(decimals.length, 5);
    for (const column of decimals) {
      assert.equal(column.numeric_precision, column.column_name === 'weight' ? 12 : 18);
      assert.equal(column.numeric_scale, column.column_name === 'weight' ? 4 : 2);
    }
    const constraints =
      await prisma.$queryRaw`SELECT count(*)::int AS count FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY'`;
    const rowCounts = Object.fromEntries(
      await Promise.all(models.map(async (model) => [model, await prisma[model].count()])),
    );
    console.log(
      JSON.stringify({
        schema: 'PASS',
        tables: existing.map((row) => row.tablename),
        migrations,
        decimals,
        foreignKeys: constraints[0].count,
        rowCounts,
      }),
    );
  }
} catch {
  console.error(
    'SCHEMA_VERIFICATION_FAILED: 연결 대상 또는 DB 구조를 확인하세요. 비밀값과 내부 오류는 출력하지 않습니다.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
