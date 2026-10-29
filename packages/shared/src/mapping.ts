export type SearchResult =
  | { kind: 'NORMAL'; verified: true; codes: string[] }
  | { kind: 'AUTH_REQUIRED' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'PARSING_ERROR' | 'UNVERIFIED' };

export function productKey(code: string) {
  const normalized = code.trim().toUpperCase();
  return /^[BRN]\d{9}$/.test(normalized)
    ? {
        category: normalized[0]!,
        suffix: normalized.slice(-5),
        key: `${normalized[0]}:${normalized.slice(-5)}`,
      }
    : null;
}

export function matchProduct(sku: string, result: SearchResult) {
  const key = productKey(sku);
  if (!key) return { status: 'UNSUPPORTED' as const };
  if (result.kind !== 'NORMAL') return { status: 'FAILED' as const, reason: result.kind };
  if (result.verified !== true) return { status: 'FAILED' as const, reason: 'UNVERIFIED' };
  if (result.codes.some((code) => !/^[A-Z]\d{9}$/.test(code.trim().toUpperCase())))
    return { status: 'FAILED' as const, reason: 'INVALID_PRODUCT_CODE' };
  const matches = [...new Set(result.codes.map((code) => code.trim().toUpperCase()))].filter(
    (code) => productKey(code)?.key === key.key,
  );
  if (!matches.length) return { status: 'SOLD_OUT' as const };
  if (matches.length > 1) return { status: 'NEEDS_REVIEW' as const, reason: 'AMBIGUOUS_PRODUCT' };
  return { status: 'MATCHED' as const, itId: matches[0]!, matchKey: key.key };
}

export interface StoreOptionInput {
  id: string;
  values: string[];
  usable: boolean;
}
export interface SupplierOptionInput {
  id: string;
  rawName: string;
  supplyPrice: string;
  active: boolean;
}
const normalize = (value: string) =>
  value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');
function color(value: string) {
  const aliases: Record<string, string> = {
    silver: 'Silver',
    실버: 'Silver',
    gold: 'Gold',
    골드: 'Gold',
    rosegold: 'RoseGold',
    로즈골드: 'RoseGold',
  };
  return aliases[normalize(value)];
}
function size(value: string) {
  const clean = normalize(value).replace(/호$/, '');
  return /^(?:0|[1-9]\d*)(?:\.5)?$/.test(clean) ? clean : undefined;
}
export function supplierOptionKey(rawName: string) {
  const match = /^(Silver|Gold|Rose\s*Gold)\s+(\d+(?:\.5)?)$/i.exec(rawName.trim());
  return match ? { color: color(match[1]!)!, size: size(match[2]!)! } : null;
}

/** Read-only plan. IDs may be DB IDs or barcode candidates, not assumed stable supplier IDs. */
export function mapOptions(
  groups: string[],
  store: StoreOptionInput[],
  supplier: SupplierOptionInput[],
) {
  const names = groups.map(normalize);
  const sizeIndex = names.findIndex((name) => ['size', '사이즈', '호수'].includes(name));
  const colorIndex = names.findIndex((name) => ['color', '색상', '컬러'].includes(name));
  const valid =
    (groups.length === 1 && sizeIndex === 0) ||
    (groups.length === 2 && sizeIndex >= 0 && colorIndex >= 0);
  const rule = colorIndex < 0 ? 'SIZE_ONLY_SILVER' : 'COLOR_AND_SIZE';
  const prepared = supplier
    .filter((option) => option.active)
    .map((option) => ({ ...option, key: supplierOptionKey(option.rawName) }));
  const duplicateStoreIds = new Set(
    store
      .filter((option, index) => store.findIndex((other) => other.id === option.id) !== index)
      .map((option) => option.id),
  );
  const preliminary = store.map((option) => {
    const review = (reason: string) => ({
      storeOptionId: option.id,
      status: 'NEEDS_REVIEW' as const,
      reason,
    });
    if (!option.usable)
      return { storeOptionId: option.id, status: 'SKIPPED' as const, reason: 'UNUSABLE' };
    if (!valid || option.values.length !== groups.length) return review('UNSUPPORTED_GROUPS');
    if (!option.id || duplicateStoreIds.has(option.id)) return review('INVALID_STORE_OPTION_ID');
    const wantedColor = colorIndex < 0 ? 'Silver' : color(option.values[colorIndex]!);
    const wantedSize = size(option.values[sizeIndex]!);
    if (!wantedColor || !wantedSize) return review('UNKNOWN_COLOR_OR_SIZE');
    const candidates = prepared.filter(
      (candidate) => candidate.key?.color === wantedColor && candidate.key.size === wantedSize,
    );
    if (candidates.length !== 1)
      return review(candidates.length ? 'AMBIGUOUS_OPTION' : 'OPTION_NOT_FOUND');
    const candidate = candidates[0]!;
    if (!candidate.id || supplier.filter((other) => other.id === candidate.id).length !== 1)
      return review('INVALID_SUPPLIER_OPTION_ID');
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(candidate.supplyPrice))
      return review('INVALID_PRICE');
    return {
      storeOptionId: option.id,
      status: 'MATCHED' as const,
      supplierOptionId: candidate.id,
      supplyPrice: candidate.supplyPrice,
      rule,
    };
  });
  return preliminary.map((row) =>
    row.status === 'MATCHED' &&
    preliminary.filter(
      (other) => other.status === 'MATCHED' && other.supplierOptionId === row.supplierOptionId,
    ).length > 1
      ? {
          storeOptionId: row.storeOptionId,
          status: 'NEEDS_REVIEW' as const,
          reason: 'DUPLICATE_STORE_VARIANT',
        }
      : row,
  );
}
