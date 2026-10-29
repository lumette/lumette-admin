import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@lumette/database';
import { normalizeProduct } from '../dist/naver/products.js';
import { changed, fetchStoreProducts } from '../dist/naver/import.js';

const detail = () => ({
  originProduct: {
    id: 123,
    name: '검증 상품',
    salePrice: 17900,
    statusType: 'SALE',
    detailAttribute: {
      manufactureDefineNo: 'R260115255',
      optionInfo: {
        optionCombinationGroupNames: { optionGroupName1: 'size' },
        optionCombinations: [
          { id: 456, optionName1: '11', price: 0, stockQuantity: 10, usable: true },
        ],
      },
    },
  },
});
test('네이버 품번과 옵션 ID를 보존하고 사이즈만 있으면 Silver로 정규화', () => {
  const result = normalizeProduct(detail(), '123', ['99']);
  assert.equal(result.manufactureDefineNo, 'R260115255');
  assert.equal(result.options[0].naverOptionId, '456');
  assert.equal(result.options[0].color, 'Silver');
  assert.equal(result.salePrice, '17900');
  assert.equal(result.options[0].priceAdjustment, '0');
});
test('옵션 없는 상품은 색상을 추정하거나 가상 옵션을 만들지 않는다', () => {
  const input = detail();
  input.originProduct.detailAttribute.optionInfo = {};
  assert.deepEqual(normalizeProduct(input, '123', []).options, []);
  assert.equal(normalizeProduct(input, '123', []).optionsComplete, false);
});
test('동일 Decimal 및 JSON 객체 키 순서 차이는 UPDATE하지 않는다', () => {
  assert.equal(
    changed(
      { price: new Prisma.Decimal('100.00'), groups: [{ value: '11', name: 'size' }] },
      { price: '100', groups: [{ name: 'size', value: '11' }] },
    ),
    false,
  );
  assert.equal(changed({ price: new Prisma.Decimal('100.00') }, { price: '101' }), true);
});
test('품번의 임의 다른 필드에서 값을 추론하지 않는다', () => {
  const input = detail();
  delete input.originProduct.detailAttribute.manufactureDefineNo;
  input.originProduct.detailAttribute.naverShoppingSearchInfo = {
    manufactureDefineNo: 'R260115255',
  };
  const result = normalizeProduct(input, '123', []);
  assert.equal(result.manufactureDefineNo, null);
  assert.equal(result.initialMappingStatus, 'UNSUPPORTED');
});
test('중복 옵션 ID, 부동소수 가격, 누락된 사용 여부를 거절한다', () => {
  for (const change of [
    (input) =>
      input.originProduct.detailAttribute.optionInfo.optionCombinations.push({
        ...input.originProduct.detailAttribute.optionInfo.optionCombinations[0],
      }),
    (input) => {
      input.originProduct.salePrice = 1.1;
    },
    (input) => {
      delete input.originProduct.detailAttribute.optionInfo.optionCombinations[0].usable;
    },
  ]) {
    const input = detail();
    change(input);
    assert.throws(() => normalizeProduct(input, '123', []));
  }
});
test('확인하지 않은 옵션 형태는 기존 옵션 삭제로 해석하지 않는다', () => {
  const input = detail();
  input.originProduct.detailAttribute.optionInfo.optionSimple = [{}];
  assert.throws(() => normalizeProduct(input, '123', []), { code: 'UNSUPPORTED_OPTION_FORMAT' });
});
test('불완전한 목록은 상세 요청·DB 저장 전에 중단한다', async () => {
  let reads = 0;
  await assert.rejects(
    fetchStoreProducts(
      {
        listProducts: async () => ({ totalElements: 2, contents: [] }),
        getOriginProduct: async () => {
          reads++;
        },
      },
      async () => {},
    ),
    { code: 'INCOMPLETE_OR_OVERSIZED_LIST' },
  );
  assert.equal(reads, 0);
});
test('상세 요청 실패는 일부 결과를 반환하지 않는다', async () => {
  await assert.rejects(
    fetchStoreProducts(
      {
        listProducts: async () => ({
          totalElements: 1,
          contents: [{ originProductNo: 123, channelProducts: [] }],
        }),
        getOriginProduct: async () => {
          throw new Error('SIMULATED');
        },
      },
      async () => {},
    ),
  );
});
