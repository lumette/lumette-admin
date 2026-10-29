import { productKey } from '@lumette/shared/mapping';
import { object, NaverCommerceError } from './client.js';

function text(value: unknown, max = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new NaverCommerceError('INVALID_PRODUCT_DATA');
  return value;
}
function id(value: unknown): string {
  const result = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof result !== 'string' || !/^\d{1,20}$/.test(result))
    throw new NaverCommerceError('INVALID_PRODUCT_ID');
  return result;
}
function money(value: unknown, signed = false): string {
  const result = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (
    typeof result !== 'string' ||
    !(signed ? /^-?\d{1,16}(?:\.\d{1,2})?$/ : /^\d{1,16}(?:\.\d{1,2})?$/).test(result)
  )
    throw new NaverCommerceError('INVALID_PRODUCT_PRICE');
  return result;
}
const optional = (value: unknown) => (value === undefined || value === null ? {} : object(value));

export function normalizeProduct(
  response: unknown,
  originProductNo: string,
  channelProductNos: string[],
) {
  const product = object(object(response).originProduct);
  if (product.id !== undefined && id(product.id) !== originProductNo)
    throw new NaverCommerceError('PRODUCT_ID_MISMATCH');
  const attribute = optional(product.detailAttribute);
  const optionInfo = optional(attribute.optionInfo);
  for (const key of ['optionSimple', 'optionCustom', 'optionStandards', 'standardOptionGroups']) {
    const value = optionInfo[key];
    if (value !== undefined && value !== null && (!Array.isArray(value) || value.length))
      throw new NaverCommerceError('UNSUPPORTED_OPTION_FORMAT');
  }
  const groupNames = optional(optionInfo.optionCombinationGroupNames);
  const names: string[] = [];
  for (let index = 1; index <= 3; index++) {
    const name = groupNames[`optionGroupName${index}`];
    if (name !== undefined && name !== null && name !== '') names.push(text(name, 100));
    else if (
      Object.keys(groupNames).some(
        (key) =>
          /^optionGroupName[1-3]$/.test(key) && Number(key.slice(-1)) > index && groupNames[key],
      )
    )
      throw new NaverCommerceError('INVALID_OPTION_GROUPS');
  }
  const rawOptions = optionInfo.optionCombinations ?? [];
  const optionsComplete = Array.isArray(optionInfo.optionCombinations);
  if (!Array.isArray(rawOptions) || rawOptions.length > 1000)
    throw new NaverCommerceError('INVALID_OPTIONS');
  if (rawOptions.length && !names.length) throw new NaverCommerceError('INVALID_OPTION_GROUPS');
  const options = rawOptions.map((value) => {
    const option = object(value);
    const groupValues = names.map((name, index) => ({
      name,
      value: text(option[`optionName${index + 1}`], 200),
    }));
    for (let index = names.length + 1; index <= 3; index++)
      if (option[`optionName${index}`]) throw new NaverCommerceError('INVALID_OPTION_GROUPS');
    if (typeof option.usable !== 'boolean') throw new NaverCommerceError('INVALID_OPTION_STATUS');
    const stock = option.stockQuantity;
    if (
      stock !== undefined &&
      stock !== null &&
      (!Number.isSafeInteger(stock) || Number(stock) < 0 || Number(stock) > 2147483647)
    )
      throw new NaverCommerceError('INVALID_STOCK');
    const sizeValue =
      groupValues
        .find((group) =>
          ['size', '사이즈', '호수'].includes(group.name.normalize('NFKC').trim().toLowerCase()),
        )
        ?.value.normalize('NFKC')
        .trim()
        .replace(/호$/, '') ?? null;
    const size = sizeValue && /^\d+(?:\.5)?$/.test(sizeValue) ? sizeValue : null;
    const colorValue = groupValues
      .find((group) =>
        ['color', '색상', '컬러'].includes(group.name.normalize('NFKC').trim().toLowerCase()),
      )
      ?.value.normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    const aliases: Record<string, string> = {
      silver: 'Silver',
      실버: 'Silver',
      gold: 'Gold',
      골드: 'Gold',
      rosegold: 'RoseGold',
      로즈골드: 'RoseGold',
    };
    return {
      naverOptionId: id(option.id),
      groupValues,
      rawName: groupValues.map((group) => group.value).join(' / '),
      color: colorValue
        ? (aliases[colorValue] ?? null)
        : names.length === 1 && size
          ? 'Silver'
          : null,
      size,
      priceAdjustment: money(option.price, true),
      stockQuantity: stock === undefined || stock === null ? null : Number(stock),
      usable: option.usable,
      active: true,
    };
  });
  if (new Set(options.map((option) => option.naverOptionId)).size !== options.length)
    throw new NaverCommerceError('DUPLICATE_OPTION_ID');
  const manufactureDefineNo =
    attribute.manufactureDefineNo === undefined ||
    attribute.manufactureDefineNo === null ||
    attribute.manufactureDefineNo === ''
      ? null
      : text(attribute.manufactureDefineNo, 100);
  const key = productKey(manufactureDefineNo ?? '');
  return {
    originProductNo: id(originProductNo),
    channelProductNos: [...new Set(channelProductNos.map(id))].sort(),
    manufactureDefineNo,
    name: text(product.name),
    salePrice: money(product.salePrice),
    naverStatus: text(product.statusType, 100),
    categoryCode: key?.category ?? null,
    mappingSuffix: key?.suffix ?? null,
    initialMappingStatus: key ? ('UNMAPPED' as const) : ('UNSUPPORTED' as const),
    initialMappingReason: key ? 'SUPPLIER_SEARCH_REQUIRED' : 'UNSUPPORTED_OR_MISSING_SKU',
    optionsComplete,
    options,
  };
}
export type NormalizedStoreProduct = ReturnType<typeof normalizeProduct>;

export function listIdentity(value: unknown) {
  const row = object(value);
  if (!Array.isArray(row.channelProducts)) throw new NaverCommerceError('INVALID_PRODUCT_LIST');
  return {
    originProductNo: id(row.originProductNo),
    channelProductNos: row.channelProducts.map((entry) => id(object(entry).channelProductNo)),
  };
}
