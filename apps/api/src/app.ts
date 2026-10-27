import Fastify from 'fastify';
import cors from '@fastify/cors';
import { timingSafeEqual } from 'node:crypto';
import { prisma, syncSamples, scenarios } from '@lumette/database';

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
      prisma.product.findMany({
        skip: (page - 1) * 20,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      prisma.product.count(),
    ]);
    return { items, total, page, pageSize: 20 };
  });
  // Static route is deliberately registered before the product ID route.
  app.get('/api/products/changes', async () => {
    const [items, total] = await prisma.$transaction([
      prisma.productChangeLog.findMany({
        take: 100,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { supplierProduct: { select: { name: true, isSample: true } } },
      }),
      prisma.productChangeLog.count(),
    ]);
    return { items, total, limit: 100 };
  });
  app.get('/api/dashboard', async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [productCount, recentChangeCount] = await prisma.$transaction([
      prisma.product.count(),
      prisma.productChangeLog.count({ where: { createdAt: { gte: since } } }),
    ]);
    return { productCount, recentChangeCount, days: 7 };
  });
  app.get<{ Params: { id: string } }>('/api/products/:id', async (request, reply) => {
    const item = await prisma.product.findUnique({
      where: { id: request.params.id },
      include: { mappings: { include: { supplierProduct: true } } },
    });
    return item ?? reply.code(404).send({ error: '상품을 찾을 수 없습니다.' });
  });
  app.post('/api/suppliers/sync', async (request, reply) => {
    const token = process.env.SYNC_API_TOKEN;
    const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const authenticated =
      token &&
      Buffer.byteLength(supplied) === Buffer.byteLength(token) &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
    // In production a token is mandatory; an unauthenticated reverse proxy
    // cannot enable this route by supplying a forged loopback header.
    if (!authenticated) {
      const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip);
      if (
        token ||
        process.env.ALLOW_SAMPLE_SYNC !== 'true' ||
        process.env.NODE_ENV === 'production' ||
        !loopback
      )
        return reply.code(403).send({ error: '동기화 접근 권한이 없습니다.' });
    }
    const body = request.body as { source?: unknown; scenario?: unknown } | null;
    if (
      !body ||
      body.source !== 'sample' ||
      !scenarios.includes(body.scenario as (typeof scenarios)[number])
    )
      return reply
        .code(400)
        .send({ error: 'source=sample과 baseline/price/status/name 시나리오만 허용됩니다.' });
    const result = await syncSamples(body.scenario as (typeof scenarios)[number]);
    return {
      id: result.id,
      status: result.status,
      processed: result.processed,
      changeCount: result.changeCount,
    };
  });
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
  return app;
}
