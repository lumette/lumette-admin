import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapOptions, matchProduct, productKey } from '../dist/mapping.js';

const normal = (codes) => ({ kind: 'NORMAL', verified: true, codes });
const store = [{ id: 'naver-1', values: ['11'], usable: true }];
const options = [
  { id: 'silver-11', rawName: 'Silver 11', supplyPrice: '11000', active: true },
  { id: 'gold-11', rawName: 'Gold 11', supplyPrice: '14000', active: true },
];
test('품번 첫 글자와 마지막 5자리를 모두 검증한다', () => {
  assert.equal(productKey('B260128005').key, 'B:28005');
  assert.equal(matchProduct('B260128005', normal(['R220728005', 'B220728005'])).itId, 'B220728005');
  assert.equal(matchProduct('B260128005', normal(['B2207280059'])).status, 'FAILED');
});
test('여러 후보는 임의로 선택하지 않는다', () => {
  assert.equal(
    matchProduct('B260128005', normal(['B220728005', 'B230728005'])).status,
    'NEEDS_REVIEW',
  );
});
test('정상 검증된 0건만 품절이며 오류는 실패로 남긴다', () => {
  assert.equal(matchProduct('B260128005', normal([])).status, 'SOLD_OUT');
  for (const kind of [
    'AUTH_REQUIRED',
    'HTTP_ERROR',
    'NETWORK_ERROR',
    'PARSING_ERROR',
    'UNVERIFIED',
  ])
    assert.equal(matchProduct('B260128005', { kind }).status, 'FAILED');
  assert.equal(
    matchProduct('B260128005', { kind: 'NORMAL', verified: false, codes: [] }).status,
    'FAILED',
  );
});
test('지원 외 분류는 품절로 판정하지 않는다', () =>
  assert.equal(matchProduct('E251293185', normal([])).status, 'UNSUPPORTED'));
test('사이즈만 있으면 Silver이며 가격은 옵션 실제 가격을 그대로 사용한다', () => {
  const [row] = mapOptions(['size'], store, options);
  assert.equal(row.supplierOptionId, 'silver-11');
  assert.equal(row.supplyPrice, '11000');
  assert.equal(row.rule, 'SIZE_ONLY_SILVER');
});
test('색상과 사이즈를 모두 비교한다', () =>
  assert.equal(
    mapOptions(['사이즈', '색상'], [{ ...store[0], values: ['11호', 'Gold'] }], options)[0]
      .supplierOptionId,
    'gold-11',
  ));
test('옵션 없음 및 알 수 없는 그룹은 Silver로 추정하지 않는다', () => {
  assert.equal(mapOptions([], [{ ...store[0], values: [] }], options)[0].status, 'NEEDS_REVIEW');
  assert.equal(mapOptions(['중량'], store, options)[0].status, 'NEEDS_REVIEW');
});
test('동일 색상/사이즈 공급처 후보 중복은 확인 필요', () =>
  assert.equal(
    mapOptions(['size'], store, [...options, { ...options[0], id: 'other' }])[0].reason,
    'AMBIGUOUS_OPTION',
  ));
test('매핑 없음은 확인 필요, 비활성 옵션은 제외', () => {
  assert.equal(
    mapOptions(['size'], store, [{ ...options[0], active: false }])[0].reason,
    'OPTION_NOT_FOUND',
  );
});
test('동일 공급처 옵션을 여러 스토어 옵션에 연결하지 않는다', () => {
  const rows = mapOptions(['size'], [...store, { ...store[0], id: 'naver-2' }], options);
  assert.ok(rows.every((row) => row.reason === 'DUPLICATE_STORE_VARIANT'));
});
test('가격 누락 및 잘못된 소수값은 거절한다', () =>
  assert.equal(
    mapOptions(['size'], store, [{ ...options[0], supplyPrice: 'NaN' }])[0].reason,
    'INVALID_PRICE',
  ));
test('동일 입력은 동일 계획을 생성하며 원본을 변경하지 않는다', () => {
  const before = JSON.stringify({ store, options });
  assert.deepEqual(mapOptions(['size'], store, options), mapOptions(['size'], store, options));
  assert.equal(JSON.stringify({ store, options }), before);
});
