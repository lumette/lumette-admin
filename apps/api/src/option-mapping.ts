import { prisma } from '@lumette/database';
import { mapOptions } from '@lumette/shared/mapping';

function groups(value: unknown): { names: string[]; values: string[] } | null {
  if (!Array.isArray(value) || value.length > 3) return null;
  const names: string[] = [];
  const values: string[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.name !== 'string' ||
      typeof item.value !== 'string'
    )
      return null;
    names.push(item.name);
    values.push(item.value);
  }
  return { names, values };
}

/** Persisted groupValues format: [{name: 'size', value: '11'}]. No writes here. */
export async function previewStoredOptionMappings(storeProductId: string) {
  const product = await prisma.storeProduct.findUnique({
    where: { id: storeProductId },
    include: {
      options: { where: { active: true }, orderBy: { naverOptionId: 'asc' } },
      mappings: {
        where: { status: 'MATCHED', supplier: 'silvertherapy' },
        include: { supplierProduct: { include: { options: true } } },
      },
    },
  });
  if (!product) return null;
  const mapping = product.mappings[0];
  if (!mapping || mapping.supplierProduct.status !== 'ACTIVE')
    return { status: 'NEEDS_REVIEW', reason: 'ACTIVE_PRODUCT_MAPPING_REQUIRED', plan: [] };
  const parsed = product.options.map((option) => groups(option.groupValues));
  const names = parsed[0]?.names ?? [];
  const plan = mapOptions(
    names,
    product.options.map((option, index) => ({
      id: option.id,
      usable: option.usable,
      values:
        JSON.stringify(parsed[index]?.names) === JSON.stringify(names) ? parsed[index]!.values : [],
    })),
    mapping.supplierProduct.options.map((option) => ({
      id: option.id,
      rawName: option.rawName,
      supplyPrice: option.supplyPrice.toString(),
      active: option.active,
    })),
  );
  return {
    status: 'PREVIEW_ONLY',
    productMappingId: mapping.id,
    plan,
    identities: mapping.supplierProduct.options.map((option) => ({
      id: option.id,
      source: option.identitySource,
    })),
    // Barcode stability still requires verification; this endpoint never saves.
    persisted: false,
  };
}
