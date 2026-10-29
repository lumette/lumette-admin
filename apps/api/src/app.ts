import Fastify from 'fastify';
import cors from '@fastify/cors';
import { timingSafeEqual } from 'node:crypto';
import { prisma, type StoreProduct } from '@lumette/database';
import { previewStoredOptionMappings } from './option-mapping.js';

function productDto(product: StoreProduct) {
  return {
    ...product,
    sku: product.manufactureDefineNo,
    price: product.salePrice.toString(),
    status: product.naverStatus,
  };
}

export function createApp() {
  const app = Fastify({ logger: { redact: ['req.headers.authorization'] } });
  app.register(cors, { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });
  app.setErrorHandler((_error, _request, reply) => {
    reply.code(500).send({ error: '처리 중 오류가 발생했습니다.' });
  });
  app.get('/health', async () => ({ status: 'ok', service: 'lumette-api' }));
  app.get('/health/db', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      return reply.code(503).send({ status: 'error', database: 'unavailable' });
    }
  });
  app.get('/api/products', async (request) => {
    const query = request.query as { page?: string };
    const page = Math.max(1, Math.min(10000, Number.parseInt(query.page ?? '1', 10) || 1));
    const [items, total] = await prisma.$transaction([
      prisma.storeProduct.findMany({
        skip: (page - 1) * 20,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      prisma.storeProduct.count(),
    ]);
    return { items: items.map(productDto), total, page, pageSize: 20 };
  });
  // Static route is deliberately registered before the product ID route.
  app.get('/api/products/changes', async () => {
    const [items, total] = await prisma.$transaction([
      prisma.productChangeLog.findMany({
        take: 100,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { supplierProduct: { select: { name: true } } },
      }),
      prisma.productChangeLog.count(),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        field: item.type,
        previousValue: JSON.stringify(item.previousValue),
        newValue: JSON.stringify(item.newValue),
      })),
      total,
      limit: 100,
    };
  });
  app.get('/api/dashboard', async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [productCount, recentChangeCount] = await prisma.$transaction([
      prisma.storeProduct.count(),
      prisma.productChangeLog.count({ where: { createdAt: { gte: since } } }),
    ]);
    return { productCount, recentChangeCount, days: 7 };
  });
  app.get<{ Params: { id: string } }>('/api/products/:id', async (request, reply) => {
    const item = await prisma.storeProduct.findUnique({
      where: { id: request.params.id },
      include: {
        options: true,
        mappings: {
          include: {
            supplierProduct: true,
            options: { include: { storeProductOption: true, supplierProductOption: true } },
          },
        },
      },
    });
    if (!item) return reply.code(404).send({ error: '상품을 찾을 수 없습니다.' });
    return {
      ...productDto(item),
      options: item.options,
      mappings: item.mappings.map((mapping) => ({
        ...mapping,
        supplierProduct: {
          ...mapping.supplierProduct,
          price: mapping.supplierProduct.basePrice?.toString() ?? null,
          externalId: mapping.supplierProduct.itId,
        },
      })),
    };
  });
  app.post('/api/suppliers/sync', async (request, reply) => {
    const token = process.env.SYNC_API_TOKEN;
    const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const authenticated =
      token &&
      Buffer.byteLength(supplied) === Buffer.byteLength(token) &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
    if (!authenticated) {
      return reply.code(403).send({ error: '동기화 접근 권한이 없습니다.' });
    }
    return reply.code(501).send({
      error: '샘플 동기화는 비활성화되었습니다. 실제 수집 검증 및 DB 적용 승인 후 활성화합니다.',
    });
  });
  app.get<{ Params: { id: string } }>(
    '/api/products/:id/options/preview',
    async (request, reply) => {
      const result = await previewStoredOptionMappings(request.params.id);
      return result ?? reply.code(404).send({ error: '상품을 찾을 수 없습니다.' });
    },
  );
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
  return app;
}
