import { collectPage } from './collector.js';
import { mappingKey, cleanProductUrl, validateReport } from './protocol.js';

const field = (id) => document.getElementById(id);
let report;
let busy = false;
const run = (action) => async () => {
  if (busy) return;
  busy = true;
  try {
    await action();
  } catch {
    field('status').textContent =
      '실패: 실버테라피 상품 탭과 진단 서버 실행 상태를 확인하세요. 인증/비밀값이 포함될 가능성이 있는 데이터는 전송하지 않습니다.';
  } finally {
    busy = false;
  }
};

field('search').addEventListener(
  'click',
  run(async () => {
    const key = mappingKey(field('sku').value.trim().toUpperCase());
    await chrome.tabs.create({
      url: `https://silvertherapy.shop/silver/product_list.php?keyword=${key.suffix}`,
    });
  }),
);

field('analyze').addEventListener(
  'click',
  run(async () => {
    report = undefined;
    field('send').disabled = true;
    field('preview').textContent = '';
    const sku = field('sku').value.trim().toUpperCase();
    const size = field('size').value.trim();
    mappingKey(sku);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    cleanProductUrl(tab?.url ?? '');
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectPage,
      args: [sku, size],
    });
    if (!validateReport(result?.result)) throw new Error('UNSAFE_REPORT');
    report = result.result;
    field('preview').textContent = JSON.stringify(report, null, 2);
    field('status').textContent =
      `상품 필드 후보 ${report.fields.length}개 / 상품 링크 ${report.productLinks.length}건. 미리보기를 확인하고 보내 주세요.`;
    field('send').disabled = false;
  }),
);

field('send').addEventListener(
  'click',
  run(async () => {
    if (!report || !validateReport(report)) throw new Error('NO_REPORT');
    // Generated locally by the receiver, excluded from Git. This is a short-lived
    // localhost pairing secret, never a supplier credential.
    const { receiverToken } = await import('./local-settings.js');
    const response = await fetch('http://127.0.0.1:43187/report', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receiverToken}` },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('RECEIVER_REJECTED');
    field('status').textContent =
      '전송 완료. 이 PC의 .diagnostics/silvertherapy 폴더에 저장했습니다.';
  }),
);
