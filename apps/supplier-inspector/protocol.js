export const ORIGIN = 'https://silvertherapy.shop';
export const PATHS = [
  '/silver/index.php',
  '/silver/product_list.php',
  '/silver/product_detail_serve.php',
];

export function mappingKey(sku) {
  if (!/^[BRN]\d{9}$/.test(sku)) throw new Error('B/R/N + 숫자 9자리 품번을 입력하세요.');
  return { category: sku[0], suffix: sku.slice(-5) };
}

export function cleanProductUrl(value) {
  const url = new URL(value);
  if (url.origin !== ORIGIN || !PATHS.includes(url.pathname))
    throw new Error('실버테라피 상품 또는 검색 페이지를 열어 주세요.');
  const clean = new URL(url.pathname, ORIGIN);
  const code = url.searchParams.get('it_id');
  if (code && /^[A-Z]\d{9}$/.test(code)) clean.searchParams.set('it_id', code);
  const keyword = url.searchParams.get('keyword');
  if (keyword && /^\d{5}$/.test(keyword)) clean.searchParams.set('keyword', keyword);
  return clean.href;
}

// Only this schema crosses the localhost receiver boundary. Unexpected keys,
// including cookies, credentials and entire HTML documents, are rejected.
export function validateReport(value) {
  const object = (item, keys) =>
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    Object.keys(item).every((key) => keys.includes(key));
  const text = (item, max = 500) =>
    typeof item === 'string' &&
    item.length <= max &&
    !/[<>]/.test(item) &&
    !/(?:PHPSESSID|document\.cookie|Bearer\s|password\s*[:=]|https?:\/\/[^\s]*[?&](?:token|sid|session)=)/i.test(
      item,
    );
  if (
    !object(value, [
      'version',
      'sku',
      'size',
      'page',
      'searchState',
      'productLinks',
      'fields',
      'rows',
      'searchForms',
      'warnings',
    ])
  )
    return false;
  try {
    mappingKey(value.sku);
    if (cleanProductUrl(value.page) !== value.page) return false;
  } catch {
    return false;
  }
  if (value.version !== 1 || !text(value.size, 30) || value.searchState !== 'UNVERIFIED')
    return false;
  if (
    !Array.isArray(value.productLinks) ||
    value.productLinks.length > 100 ||
    !value.productLinks.every((code) => /^[A-Z]\d{9}$/.test(code))
  )
    return false;
  const field = (item) =>
    object(item, ['name', 'type', 'value', 'choices']) &&
    /^(?:it|itop)_(?:id|pay|name|subject|on|barcode|price|weight|add_price|add_pay|supply_price|stock|qty)(?:\[\])?$/.test(
      item.name,
    ) &&
    text(item.type, 30) &&
    text(item.value, 200) &&
    Array.isArray(item.choices) &&
    item.choices.length <= 100 &&
    item.choices.every(
      (choice) =>
        object(choice, ['value', 'label']) && text(choice.value, 200) && text(choice.label, 200),
    );
  if (!Array.isArray(value.fields) || value.fields.length > 500 || !value.fields.every(field))
    return false;
  if (
    !Array.isArray(value.rows) ||
    value.rows.length > 100 ||
    !value.rows.every(
      (row) =>
        object(row, ['text', 'fields']) &&
        text(row.text) &&
        Array.isArray(row.fields) &&
        row.fields.length <= 30 &&
        row.fields.every(field),
    )
  )
    return false;
  if (
    !Array.isArray(value.searchForms) ||
    value.searchForms.length > 10 ||
    !value.searchForms.every(
      (form) =>
        object(form, ['path', 'method', 'keywordName']) &&
        form.path === '/silver/product_list.php' &&
        ['GET', 'POST'].includes(form.method) &&
        form.keywordName === 'keyword',
    )
  )
    return false;
  return (
    Array.isArray(value.warnings) &&
    value.warnings.length <= 10 &&
    value.warnings.every((item) => text(item))
  );
}
