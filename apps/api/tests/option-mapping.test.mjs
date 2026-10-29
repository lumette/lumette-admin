import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@lumette/database';
import { previewStoredOptionMappings } from '../dist/option-mapping.js';

const original = prisma.storeProduct.findUnique;
const product = () => ({
  options: [{ id: 'store-option', usable: true, groupValues: [{ name: 'size', value: '11' }] }],
  mappings: [
    {
      id: 'mapping',
      supplierProduct: {
        status: 'ACTIVE',
        options: [
          {
            id: 'supplier-option',
            rawName: 'Silver 11',
            supplyPrice: '11000',
            active: true,
            identitySource: 'BARCODE_CANDIDATE',
          },
        ],
      },
    },
  ],
});
test('저장 상품 옵션의 매핑 계획을 생성하지만 저장은 하지 않는다', async () => {
  prisma.storeProduct.findUnique = async () => product();
  try {
    const result = await previewStoredOptionMappings('store-product');
    assert.equal(result.plan[0].supplierOptionId, 'supplier-option');
    assert.equal(result.persisted, false);
    assert.equal(result.identities[0].source, 'BARCODE_CANDIDATE');
  } finally {
    prisma.storeProduct.findUnique = original;
  }
});
test('품절 공급처 상품은 옵션 자동 매핑하지 않는다', async () => {
  const item = product();
  item.mappings[0].supplierProduct.status = 'SOLD_OUT';
  prisma.storeProduct.findUnique = async () => item;
  try {
    assert.equal(
      (await previewStoredOptionMappings('id')).reason,
      'ACTIVE_PRODUCT_MAPPING_REQUIRED',
    );
  } finally {
    prisma.storeProduct.findUnique = original;
  }
});
test('원본 그룹 자료가 없으면 확인 필요로 유지한다', async () => {
  const item = product();
  item.options[0].groupValues = null;
  prisma.storeProduct.findUnique = async () => item;
  try {
    assert.equal((await previewStoredOptionMappings('id')).plan[0].status, 'NEEDS_REVIEW');
  } finally {
    prisma.storeProduct.findUnique = original;
  }
});
