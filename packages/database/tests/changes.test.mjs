import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { changesBetween, sampleProducts } from '../dist/sample.js';

const stored = (item) => ({ ...item, price: new Prisma.Decimal(item.price) });
test('샘플 6개 식별자가 고유하다', () => {
  assert.equal(new Set(sampleProducts().map((p) => p.externalId)).size, 6);
});
test('동일 값과 소수점 표현 차이는 변경이 아니다', () => {
  const item = sampleProducts()[0];
  assert.deepEqual(changesBetween(stored(item), { ...item, price: '10000.00' }), []);
});
for (const [before, after, field] of [
  ['baseline', 'price', 'PRICE'],
  ['price', 'status', 'STATUS'],
  ['status', 'name', 'NAME'],
]) {
  test(`${before} → ${after}: ${field} 이력 1건만 감지`, () => {
    const next = sampleProducts(after)[0];
    assert.equal(changesBetween(stored(sampleProducts(before)[0]), next).length, 1);
    assert.equal(changesBetween(stored(sampleProducts(before)[0]), next)[0].field, field);
    assert.deepEqual(changesBetween(stored(next), next), []);
  });
}
