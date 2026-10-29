import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { prisma, Prisma } from '@lumette/database';
import { NaverReadClient, NaverCommerceError, credentialsFromEnv } from './client.js';
import { normalizeProduct, listIdentity, type NormalizedStoreProduct } from './products.js';

export async function fetchStoreProducts(
  client: Pick<NaverReadClient, 'listProducts' | 'getOriginProduct'>,
  wait = () => pause(600),
) {
  const page = await client.listProducts(1, 100);
  const total = page.totalElements;
  if (
    typeof total !== 'number' ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    total > 100 ||
    !Array.isArray(page.contents) ||
    page.contents.length !== total
  )
    throw new NaverCommerceError('INCOMPLETE_OR_OVERSIZED_LIST');
  const identities = page.contents.map(listIdentity);
  if (new Set(identities.map((item) => item.originProductNo)).size !== identities.length)
    throw new NaverCommerceError('DUPLICATE_PRODUCT_ID');
  const products: NormalizedStoreProduct[] = [];
  for (const item of identities) {
    await wait();
    products.push(
      normalizeProduct(
        await client.getOriginProduct(item.originProductNo),
        item.originProductNo,
        item.channelProductNos,
      ),
    );
  }
  return products;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

export function changed(previous: object, next: object) {
  return Object.entries(next).some(([key, value]) => {
    const old = (previous as Record<string, unknown>)[key];
    return value !== null && typeof value === 'object'
      ? canonical(old) !== canonical(value)
      : old instanceof Prisma.Decimal
        ? !old.equals(String(value))
        : old !== value;
  });
}

export async function persistStoreProducts(
  storeKey: string,
  products: NormalizedStoreProduct[],
  requestKey = randomUUID(),
) {
  if (
    !/^[A-Za-z0-9_-]{1,64}$/.test(storeKey) ||
    new Set(products.map((product) => product.originProductNo)).size !== products.length
  )
    throw new NaverCommerceError('INVALID_IMPORT');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const prior = await tx.syncHistory.findUnique({ where: { requestKey } });
          if (prior) return { replay: true, syncId: prior.id, processed: prior.processed };
          const counters = {
            productsCreated: 0,
            productsUpdated: 0,
            optionsCreated: 0,
            optionsUpdated: 0,
            optionsDeactivated: 0,
          };
          for (const product of products) {
            const {
              options,
              optionsComplete,
              initialMappingStatus,
              initialMappingReason,
              ...data
            } = product;
            const existing = await tx.storeProduct.findUnique({
              where: {
                storeKey_originProductNo: { storeKey, originProductNo: data.originProductNo },
              },
              include: { options: true },
            });
            let saved = existing;
            if (existing?.options.some((option) => option.active) && !optionsComplete)
              throw new NaverCommerceError('INCOMPLETE_OPTION_SNAPSHOT');
            if (!saved) {
              saved = {
                ...(await tx.storeProduct.create({
                  data: {
                    ...data,
                    storeKey,
                    mappingStatus: initialMappingStatus,
                    mappingReason: initialMappingReason,
                  },
                })),
                options: [],
              };
              counters.productsCreated++;
            } else if (changed(saved, data)) {
              const skuChanged = saved.manufactureDefineNo !== data.manufactureDefineNo;
              const updated = await tx.storeProduct.update({
                where: { id: saved.id },
                data: {
                  ...data,
                  ...(skuChanged
                    ? { mappingStatus: initialMappingStatus, mappingReason: initialMappingReason }
                    : {}),
                },
              });
              if (skuChanged) {
                await tx.productMapping.updateMany({
                  where: { storeProductId: saved.id, status: { not: 'NEEDS_REVIEW' } },
                  data: { status: 'NEEDS_REVIEW' },
                });
                await tx.optionMapping.updateMany({
                  where: { storeProductId: saved.id, status: { not: 'NEEDS_REVIEW' } },
                  data: { status: 'NEEDS_REVIEW' },
                });
              }
              saved = { ...updated, options: existing!.options };
              counters.productsUpdated++;
            }
            for (const option of options) {
              const priorOption = saved.options.find(
                (entry) => entry.naverOptionId === option.naverOptionId,
              );
              if (!priorOption) {
                await tx.storeProductOption.create({
                  data: { ...option, storeProductId: saved.id },
                });
                counters.optionsCreated++;
              } else if (changed(priorOption, option)) {
                await tx.storeProductOption.update({ where: { id: priorOption.id }, data: option });
                if (
                  canonical(priorOption.groupValues) !== canonical(option.groupValues) ||
                  priorOption.usable !== option.usable ||
                  !priorOption.active
                )
                  await tx.optionMapping.updateMany({
                    where: {
                      storeProductOptionId: priorOption.id,
                      status: { not: 'NEEDS_REVIEW' },
                    },
                    data: { status: 'NEEDS_REVIEW' },
                  });
                counters.optionsUpdated++;
              }
            }
            // Only a complete, validated origin detail may deactivate missing options.
            const missing = (optionsComplete ? saved.options : [])
              .filter(
                (option) =>
                  option.active &&
                  !options.some((entry) => entry.naverOptionId === option.naverOptionId),
              )
              .map((option) => option.id);
            if (missing.length) {
              await tx.storeProductOption.updateMany({
                where: { id: { in: missing } },
                data: { active: false },
              });
              await tx.optionMapping.updateMany({
                where: { storeProductOptionId: { in: missing }, status: { not: 'NEEDS_REVIEW' } },
                data: { status: 'NEEDS_REVIEW' },
              });
              counters.optionsDeactivated += missing.length;
            }
          }
          const history = await tx.syncHistory.create({
            data: {
              requestKey,
              source: 'NAVER',
              status: 'SUCCESS',
              processed: products.length,
              completedAt: new Date(),
            },
          });
          return { replay: false, syncId: history.id, processed: products.length, ...counters };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 60000,
          maxWait: 10000,
        },
      );
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      ) {
        await pause(200 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw new NaverCommerceError('IMPORT_RETRY_EXHAUSTED');
}

export async function importStoreProducts(apply: boolean) {
  const products = await fetchStoreProducts(new NaverReadClient(credentialsFromEnv()));
  if (!apply)
    return {
      mode: 'DRY_RUN',
      products: products.length,
      options: products.reduce((sum, product) => sum + product.options.length, 0),
      unsupportedSku: products.filter((product) => product.initialMappingStatus === 'UNSUPPORTED')
        .length,
    };
  return {
    mode: 'APPLIED',
    ...(await persistStoreProducts(process.env.NAVER_STORE_KEY ?? 'lumette', products)),
  };
}
