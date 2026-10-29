// Runs in the isolated extension world. Never reads cookies, browser storage,
// network headers, inline scripts, arbitrary hidden inputs, or complete HTML.
export function collectPage(sku, size) {
  const origin = 'https://silvertherapy.shop';
  const paths = [
    '/silver/index.php',
    '/silver/product_list.php',
    '/silver/product_detail_serve.php',
  ];
  if (location.origin !== origin || !paths.includes(location.pathname))
    throw new Error('허용되지 않은 페이지');
  const safe = (value, max = 200) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  const allowed =
    /^(?:it|itop)_(?:id|pay|name|subject|on|barcode|price|weight|add_price|add_pay|supply_price|stock|qty)(?:\[\])?$/;
  const nodes = Array.from(document.querySelectorAll('input[name], select[name]')).filter(
    (node) => node.type !== 'password' && allowed.test(node.name),
  );
  const read = (node) => ({
    name: node.name,
    type: safe(node.type, 30),
    value: safe(node.value),
    choices:
      node.tagName === 'SELECT' && node.name !== 'itop_qty[]'
        ? Array.from(node.options)
            .slice(0, 100)
            .map((option) => ({ value: safe(option.value), label: safe(option.textContent) }))
        : [],
  });
  // The first real detail report used neither <tr> nor <li>. Find a small
  // common container containing exactly one option name and its price field;
  // do not assume the array positions alone prove an option-price relation.
  const optionContainer = (node) => {
    let parent = node.parentElement;
    for (let depth = 0; parent && depth < 8; depth += 1, parent = parent.parentElement) {
      if (['BODY', 'HTML', 'FORM'].includes(parent.tagName)) break;
      const fields = nodes.filter((field) => parent.contains(field));
      const names = fields.filter((field) => field.name === 'itop_subject[]');
      if (names.length > 1) break;
      if (names.length === 1 && fields.some((field) => field.name === 'itop_pay[]')) return parent;
    }
    return null;
  };
  const rowNodes = [
    ...new Set(
      nodes
        .filter((node) => /itop_|it_barcode/.test(node.name))
        .map((node) => optionContainer(node) ?? node.closest('tr') ?? node.closest('li'))
        .filter(Boolean),
    ),
  ];
  const productLinks = [
    ...new Set(
      Array.from(document.querySelectorAll('a[href]')).flatMap((node) => {
        try {
          const url = new URL(node.getAttribute('href'), location.href);
          const code = url.searchParams.get('it_id');
          return url.origin === origin &&
            url.pathname === '/silver/product_detail_serve.php' &&
            /^[A-Z]\d{9}$/.test(code ?? '')
            ? [code]
            : [];
        } catch {
          return [];
        }
      }),
    ),
  ];
  const page = new URL(location.pathname, origin);
  const code = new URL(location.href).searchParams.get('it_id');
  const keyword = new URL(location.href).searchParams.get('keyword');
  if (/^[A-Z]\d{9}$/.test(code ?? '')) page.searchParams.set('it_id', code);
  if (/^\d{5}$/.test(keyword ?? '')) page.searchParams.set('keyword', keyword);
  const searchForms = Array.from(document.forms).flatMap((form) => {
    try {
      const action = new URL(form.getAttribute('action') ?? '', location.href);
      return action.origin === origin &&
        action.pathname === '/silver/product_list.php' &&
        form.querySelector('[name="keyword"]')
        ? [{ path: action.pathname, method: form.method.toUpperCase(), keywordName: 'keyword' }]
        : [];
    } catch {
      return [];
    }
  });
  return {
    version: 1,
    sku,
    size,
    page: page.href,
    searchState: 'UNVERIFIED',
    productLinks: productLinks.slice(0, 100),
    fields: nodes.slice(0, 500).map(read),
    rows: rowNodes.slice(0, 100).map((row) => ({
      text: safe(row.innerText, 500),
      fields: nodes
        .filter((node) => row.contains(node))
        .slice(0, 30)
        .map(read),
    })),
    searchForms: searchForms.slice(0, 10),
    warnings: [
      '인증 성공 및 정상 검색 결과 표식이 아직 검증되지 않아 0건을 품절로 판정하지 않습니다.',
      '옵션 ID 안정성과 가격 필드의 최종가/추가금 의미는 미검증입니다. 기본 가격을 옵션 가격으로 대입하지 않습니다.',
      ...(nodes.length > 500 || productLinks.length > 100 || rowNodes.length > 100
        ? ['크기 제한으로 일부 후보를 생략했습니다. 완전한 상품 스냅샷이 아닙니다.']
        : []),
    ],
  };
}
