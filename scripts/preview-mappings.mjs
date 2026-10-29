import { readFile, readdir } from 'node:fs/promises';
import { mapOptions, productKey } from '../packages/shared/dist/mapping.js';
import { validateReport } from '../apps/supplier-inspector/protocol.js';

// Only local, already collected diagnostics. No HTTP, DB writes, or credentials.
try {
  const naver = JSON.parse(
    await readFile(
      new URL('../.diagnostics/naver/products-readonly.json', import.meta.url),
      'utf8',
    ),
  );
  const directory = new URL('../.diagnostics/silvertherapy/', import.meta.url);
  const snapshots = new Map();
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()) {
    const report = JSON.parse(await readFile(new URL(file, directory), 'utf8'));
    const { receivedAt: _receivedAt, ...payload } = report;
    if (!validateReport(payload) || !report.rows.length) continue;
    // These collector notices are expected in a diagnostic preview, not evidence
    // of an authenticated search or a stable supplier option identifier.
    if (
      report.warnings.some(
        (warning) =>
          ![
            '인증 성공 및 정상 검색 결과 표식이 아직 검증되지 않아 0건을 품절로 판정하지 않습니다.',
            '옵션 ID 안정성과 가격 필드의 최종가/추가금 의미는 미검증입니다. 기본 가격을 옵션 가격으로 대입하지 않습니다.',
          ].includes(warning),
      )
    )
      continue;
    const values = (fields, name) =>
      fields.filter((field) => field.name === name).map((field) => field.value);
    const ids = values(report.fields, 'it_id');
    if (ids.length !== 1 || !productKey(ids[0])) continue;
    const url = new URL(report.page);
    if (
      url.pathname !== '/silver/product_detail_serve.php' ||
      url.searchParams.get('it_id') !== ids[0]
    )
      continue;
    const names = values(report.fields, 'itop_subject[]');
    if (names.length !== report.rows.length) continue;
    const options = report.rows.map((row) => {
      const single = (name) => {
        const fields = values(row.fields, name);
        if (fields.length !== 1) throw new Error('INVALID_ROW');
        return fields[0];
      };
      return {
        id: single('it_barcode[]'),
        rawName: single('itop_subject[]'),
        supplyPrice: single('itop_pay[]'),
        active: true,
      };
    });
    snapshots.set(ids[0], options);
  }
  const results = naver.details.map((product) => {
    const key = productKey(product.manufactureDefineNo ?? '');
    if (!key) return { sku: product.manufactureDefineNo, status: 'UNSUPPORTED' };
    const candidates = [...snapshots.keys()].filter((id) => productKey(id)?.key === key.key);
    if (candidates.length !== 1)
      return { sku: product.manufactureDefineNo, status: 'NEEDS_SEARCH_EVIDENCE' };
    const supplier = snapshots.get(candidates[0]);
    const groups = Object.values(product.optionCombinationGroupNames ?? {});
    const plan = mapOptions(
      groups,
      product.options.map((option) => ({
        id: option.id,
        usable: option.usable === true,
        values: [option.optionName1, option.optionName2, option.optionName3].filter(
          (value) => value !== null && value !== undefined,
        ),
      })),
      supplier,
    );
    return {
      sku: product.manufactureDefineNo,
      itId: candidates[0],
      status: 'DETAIL_PREVIEW_ONLY',
      identity: 'BARCODE_CANDIDATE',
      supplierOptions: supplier.length,
      matched: plan.filter((row) => row.status === 'MATCHED').length,
      plan,
    };
  });
  console.log(
    JSON.stringify(
      { mode: 'READ_ONLY_NO_DB_WRITE', automaticSoldOutEnabled: false, results },
      null,
      2,
    ),
  );
} catch {
  console.error('MAPPING_PREVIEW_FAILED: 로컬 진단 자료와 추출 구조를 확인하세요.');
  process.exitCode = 1;
}
