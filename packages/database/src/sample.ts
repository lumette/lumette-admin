import { Prisma } from '@prisma/client';

export const SAMPLE_SUPPLIER = 'lumette-sample';
export const scenarios = ['baseline', 'price', 'status', 'name'] as const;
export type Scenario = (typeof scenarios)[number];
export type Snapshot = {
  externalId: string;
  name: string;
  price: string;
  status: 'ACTIVE' | 'SOLD_OUT' | 'DISCONTINUED';
};

export function sampleProducts(scenario: Scenario = 'baseline'): Snapshot[] {
  const names = ['머그컵', '에코백', '노트', '텀블러', '파우치', '키링'];
  return names.map((name, i) => ({
    externalId: `sample-${i + 1}`,
    name: `[샘플] ${name}${i === 0 && scenario === 'name' ? ' 리뉴얼' : ''}`,
    price: String(10000 + i * 1000 + (i === 0 && scenario !== 'baseline' ? 500 : 0)),
    status: i === 0 && (scenario === 'status' || scenario === 'name') ? 'SOLD_OUT' : 'ACTIVE',
  }));
}

export function changesBetween(
  previous: { name: string; price: Prisma.Decimal; status: string },
  next: Snapshot,
) {
  const changes: { field: 'PRICE' | 'STATUS' | 'NAME'; previousValue: string; newValue: string }[] =
    [];
  if (!previous.price.equals(next.price))
    changes.push({
      field: 'PRICE',
      previousValue: previous.price.toFixed(2),
      newValue: new Prisma.Decimal(next.price).toFixed(2),
    });
  if (previous.status !== next.status)
    changes.push({ field: 'STATUS', previousValue: previous.status, newValue: next.status });
  if (previous.name !== next.name)
    changes.push({ field: 'NAME', previousValue: previous.name, newValue: next.name });
  return changes;
}
