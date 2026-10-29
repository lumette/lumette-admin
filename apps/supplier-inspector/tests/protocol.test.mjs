import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mappingKey, cleanProductUrl, validateReport } from '../protocol.js';
import { collectPage } from '../collector.js';

test('합성 DOM: div 옵션 컨테이너마다 이름과 가격을 따로 묶는다', () => {
  const oldDocument = globalThis.document;
  const oldLocation = globalThis.location;
  const makeRow = (name, price) => {
    const row = {
      tagName: 'DIV',
      parentElement: { tagName: 'FORM' },
      innerText: `${name} ${price}`,
    };
    const fields = [
      ['itop_subject[]', name],
      ['itop_pay[]', price],
    ].map(([fieldName, value]) => ({
      name: fieldName,
      value,
      type: 'hidden',
      tagName: 'INPUT',
      parentElement: row,
      closest: () => null,
    }));
    row.contains = (field) => fields.includes(field);
    return fields;
  };
  const nodes = [...makeRow('합성옵션 A', '1000'), ...makeRow('합성옵션 B', '2000')];
  globalThis.location = {
    origin: 'https://silvertherapy.shop',
    pathname: '/silver/product_detail_serve.php',
    href: 'https://silvertherapy.shop/silver/product_detail_serve.php?it_id=R221057427',
  };
  globalThis.document = {
    forms: [],
    querySelectorAll: (selector) => (selector === 'a[href]' ? [] : nodes),
  };
  try {
    const result = collectPage('R221057427', '11');
    assert.equal(validateReport(result), true);
    assert.equal(result.rows.length, 2);
    assert.deepEqual(
      result.rows.map((row) => row.fields.map((field) => field.value)),
      [
        ['합성옵션 A', '1000'],
        ['합성옵션 B', '2000'],
      ],
    );
  } finally {
    globalThis.document = oldDocument;
    globalThis.location = oldLocation;
  }
});

const valid = () => ({
  version: 1,
  sku: 'R221057427',
  size: '11',
  page: 'https://silvertherapy.shop/silver/product_list.php?keyword=57427',
  searchState: 'UNVERIFIED',
  productLinks: ['R221057427'],
  fields: [],
  rows: [],
  searchForms: [],
  warnings: [],
});

test('제공된 실상품 품번에서 R / 57427을 추출', () => {
  assert.deepEqual(mappingKey('R221057427'), { category: 'R', suffix: '57427' });
  assert.throws(() => mappingKey('R22105742'));
});
test('URL의 세션 및 추적 파라미터를 전달하지 않음', () => {
  assert.equal(
    cleanProductUrl(
      'https://silvertherapy.shop/silver/product_list.php?keyword=57427&PHPSESSID=test-session',
    ),
    valid().page,
  );
  assert.throws(() => cleanProductUrl('https://example.com/silver/index.php'));
  assert.throws(() => cleanProductUrl('https://silvertherapy.shop/silver/login.php'));
});
test('전체 HTML/쿠키/임의 필드를 수신 스키마에서 거부', () => {
  assert.equal(validateReport(valid()), true);
  assert.equal(validateReport({ ...valid(), cookie: 'test-cookie' }), false);
  assert.equal(validateReport({ ...valid(), html: '<html>test</html>' }), false);
  assert.equal(
    validateReport({ ...valid(), fields: [{ name: 'PHPSESSID', value: 'test' }] }),
    false,
  );
  assert.equal(validateReport({ ...valid(), warnings: ['PHPSESSID=test'] }), false);
  assert.equal(validateReport({ ...valid(), searchState: 'SOLD_OUT' }), false);
});
test('합성 DOM: 상품 필드만 추출하고 옵션 가격을 기본가로 채우지 않음', () => {
  // Synthetic fixture: deliberately not presented as supplier HTML.
  const input = (name, value, type = 'hidden') => ({
    name,
    value,
    type,
    tagName: 'INPUT',
    closest: () => null,
  });
  const nodes = [
    input('PHPSESSID', 'test-session'),
    input('password', 'test-password', 'password'),
    input('it_id', 'R221057427'),
    input('it_pay', '12345'),
    input('itop_on[]', 'candidate-id'),
    input('itop_subject[]', 'White 11'),
  ];
  const oldDocument = globalThis.document;
  const oldLocation = globalThis.location;
  globalThis.location = {
    origin: 'https://silvertherapy.shop',
    pathname: '/silver/product_detail_serve.php',
    href: 'https://silvertherapy.shop/silver/product_detail_serve.php?it_id=R221057427&PHPSESSID=test-session',
  };
  globalThis.document = {
    forms: [],
    querySelectorAll: (selector) => (selector === 'a[href]' ? [] : nodes),
  };
  try {
    const result = collectPage('R221057427', '11');
    assert.equal(validateReport(result), true);
    assert.equal(result.fields.length, 4);
    assert.equal(JSON.stringify(result).includes('test-session'), false);
    assert.equal(JSON.stringify(result).includes('test-password'), false);
    assert.equal(
      result.fields.some((field) => field.name === 'itop_price[]'),
      false,
    );
    assert.equal(result.searchState, 'UNVERIFIED');
  } finally {
    globalThis.document = oldDocument;
    globalThis.location = oldLocation;
  }
});
