import { prisma } from './client.js';
import { changesBetween, sampleProducts, SAMPLE_SUPPLIER, type Scenario } from './sample.js';

// All sample writes share this transaction-scoped lock, including the seed.
export async function syncSamples(scenario: Scenario) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(72304421)`;
        const history = await tx.syncHistory.create({
          data: { supplier: SAMPLE_SUPPLIER, scenario },
        });
        let changeCount = 0;
        for (const item of sampleProducts(scenario)) {
          const key = { supplier: SAMPLE_SUPPLIER, externalId: item.externalId };
          const previous = await tx.supplierProduct.findUnique({
            where: { supplier_externalId: key },
          });
          if (previous && !previous.isSample) throw new Error('SAMPLE_NAMESPACE_CONFLICT');
          const supplierProduct = previous
            ? await tx.supplierProduct.update({ where: { id: previous.id }, data: item })
            : await tx.supplierProduct.create({
                data: { ...item, supplier: SAMPLE_SUPPLIER, isSample: true },
              });
          if (previous) {
            const changes = changesBetween(previous, item);
            if (changes.length)
              await tx.productChangeLog.createMany({
                data: changes.map((change) => ({
                  ...change,
                  supplierProductId: supplierProduct.id,
                  syncHistoryId: history.id,
                })),
              });
            changeCount += changes.length;
          }
        }
        return tx.syncHistory.update({
          where: { id: history.id },
          data: { status: 'SUCCESS', processed: 6, changeCount, completedAt: new Date() },
        });
      },
      { maxWait: 15000, timeout: 30000 },
    );
  } catch {
    await prisma.syncHistory
      .create({
        data: {
          supplier: SAMPLE_SUPPLIER,
          scenario,
          status: 'FAILED',
          errorCode: 'SYNC_FAILED',
          completedAt: new Date(),
        },
      })
      .catch(() => {});
    throw new Error('SYNC_FAILED');
  }
}

export async function seedSamples() {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72304421)`;
      for (const item of sampleProducts()) {
        const sku = `LUMETTE-SAMPLE-${item.externalId}`;
        const existing = await tx.product.findUnique({ where: { sku } });
        if (existing && !existing.isSample) throw new Error('SAMPLE_NAMESPACE_CONFLICT');
        const product = await tx.product.upsert({
          where: { sku },
          update: {},
          create: { sku, name: item.name, price: item.price, isSample: true },
        });
        const key = { supplier: SAMPLE_SUPPLIER, externalId: item.externalId };
        const supplier = await tx.supplierProduct.findUnique({
          where: { supplier_externalId: key },
        });
        if (supplier && !supplier.isSample) throw new Error('SAMPLE_NAMESPACE_CONFLICT');
        const supplierProduct = await tx.supplierProduct.upsert({
          where: { supplier_externalId: key },
          update: {},
          create: { ...item, supplier: SAMPLE_SUPPLIER, isSample: true },
        });
        await tx.productMapping.upsert({
          where: {
            productId_supplierProductId: {
              productId: product.id,
              supplierProductId: supplierProduct.id,
            },
          },
          update: {},
          create: { productId: product.id, supplierProductId: supplierProduct.id },
        });
      }
      return { sampleProducts: 6 };
    },
    { maxWait: 15000, timeout: 30000 },
  );
}
