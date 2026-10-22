import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogUrl, eventData, flightHtml, ticketData, ticketReply } from '../fixtures/catalog';
import { installOnezoneMapDemo } from '../../src/testing/onezone-map-demo';

let context: BrowserContext, page: Page;
const errors: string[] = [];
const types = [
  { ...ticketData, type: 'zone', ticketType: 'auto_send_ticket', ticketClassId: 'ga-test', name: 'GA', finalPriceVn: 900000, maxTicketPerUser: 4 },
  { ...ticketData, type: 'zone', ticketType: 'auto_send_ticket', ticketClassId: 'fan-test', name: 'FANZONE', finalPriceVn: 1500000, seatType: 'standing_ticket', maxTicketPerUser: 4 },
];
const zones = [{ id: 'ga-a', name: 'GA A', ticketClassId: 'ga-test' }, { id: 'ga-b', name: 'GA B', ticketClassId: 'ga-test' }, { id: 'fan-a', name: 'FANZONE A', ticketClassId: 'fan-test' }].map(z => ({ ...z, eventId: eventData.id, calendarId: 'HN' }));
test.beforeEach(async () => {
  errors.length = 0;
  const extension = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(async ({ html, types, zones }) => {
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.includes('/events/catalog-test')) return new Response(html);
      return new Response(JSON.stringify({ errorCode: 0, data: url.includes('/zones?') ? zones : types }));
    };
    await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
      preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/catalog-test?calendarId=HN', startMode: 'IMMEDIATE', saleStartAt: '2030-01-01T00:00:00Z', quantity: 2,
        preferredZoneLabels: ['GA'], allowAlternatives: false, catalog: { eventId: 'event-test', performanceId: 'HN', title: 'Demo', venue: 'Cung Thiếu nhi Hà Nội', startsAt: '2030-11-21T04:00:00.000Z', verifiedAt: Date.now(),
          tickets: [{ id: 'ga-test', name: 'GA', priceVnd: 900000, seatMode: 'AUTO', maxQuantity: 4, zones: zones.filter(z => z.ticketClassId === 'ga-test').map(({ id, name }) => ({ id, name })) }] } } } });
  }, { html: flightHtml({ ...eventData, status: 'OPEN', canPurchase: true }), types: ticketReply(types).data, zones });
});
test.afterEach(async () => { await context.close(); expect(errors).toEqual([]); });

async function booking({ verification = false, groupedLegend = false, addons = false, delayed = false }: {
  verification?: boolean; groupedLegend?: boolean; addons?: 'correct' | 'wrong' | false; delayed?: boolean;
} = {}) {
  const konva = readFileSync('node_modules/konva/konva.min.js', 'utf8');
  await context.route(/^https:\/\/ticket\.1zone\.vn\//, route => {
    if (new URL(route.request().url()).pathname === '/fixture-konva.js') return route.fulfill({ contentType: 'application/javascript', body: konva });
    if (new URL(route.request().url()).pathname === '/checkout/add-ons') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><h1>Vé mua kèm</h1><section><h2>Vé của bạn · Demo</h2><p>21/11/2030 · GA × 2 · đ900.000</p></section><article>Poster · đ99.000</article><footer><b>đ${addons === 'wrong' ? '1.899.000' : '1.800.000'}</b><button onclick="document.body.innerHTML='<h1>Thanh toán</h1><form><button type=button>Xác nhận đơn hàng</button></form>'">Tiếp tục</button></footer>` });
    const legend = groupedLegend ? '<div><p>GA</p><p>đ900.000</p></div>' : '<div><p>GA A</p><p>đ900.000</p></div><div><p>GA B</p><p>đ900.000</p></div>';
    const install = `(${installOnezoneMapDemo.toString()})(document,${verification},${!!addons})`;
    const script = delayed ? `document.querySelector('[id^="seatmap-container-"]').append(document.createElement('canvas'));window.loadDelayedMap=()=>{document.querySelector('[id^="seatmap-container-"]').replaceChildren();${install}}` : install;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><main><h1>Chọn khu vực</h1><div id="seatmap-container-event-test-fixture" style="width:400px;height:220px"></div>${legend}<div><p>FANZONE A</p><p>đ1.500.000</p></div><div id="modal-host"></div></main><script src="/fixture-konva.js"></script><script>${script}</script>` });
  });
  page = await context.newPage(); await page.goto(catalogUrl.replace('/events/', '/booking/') + '?calendarId=HN');
  await expect(page.locator('.status-line')).toContainText(delayed ? 'Chưa nhận diện' : 'Đang chọn vé');
  if (!delayed) await expect(page.locator('.recommendation')).toContainText('GA B');
}

test('Konva thật: bỏ khu khóa, chọn GA B đúng class/giá, 2 vé tới checkout một lần', async () => {
  await booking();
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('GA B · 2 vé');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
  await expect(page.getByRole('button', { name: 'Xác nhận đơn hàng' })).toBeVisible();
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/konva-checkout.png' });
});

test('sơ đồ đúng renderer tải chậm quá 15 giây: vẫn camp rồi tiếp tục khi render xong', async () => {
  await booking({ groupedLegend: true, delayed: true });
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  const worker = context.serviceWorkers()[0]!;
  await worker.evaluate(async () => {
    const key = 'ticket-assistant.auto.session.v1', run = (await chrome.storage.session.get(key))[key];
    run.startedAt -= 60000;
    await chrome.storage.session.set({ [key]: run }); await chrome.tabs.sendMessage(run.tabId, { type: 'AUTO_UPDATED', run });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await expect(page.locator('main')).not.toHaveAttribute('data-selections');
  await page.evaluate(() => (window as unknown as { loadDelayedMap(): void }).loadDelayedMap());
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('GA B · 2 vé');
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
});

test('khu đổi tồn kho liên tục hơn 5 lần: nghỉ ngắn rồi tiếp tục, chỉ giữ vé một lần', async () => {
  await booking({ groupedLegend: true });
  await page.evaluate(() => {
    const host = window as unknown as { Konva: { stages: { find(selector: string): { getAttr(name: string): string; setAttr(name: string, value: boolean): void }[]; getLayers(): { draw(): void }[] }[] }; failedChoices: number };
    const stage = host.Konva.stages[0]!, node = stage.find('.seat').find(n => n.getAttr('zoneId') === 'ga-a')!;
    host.failedChoices = 0; node.setAttr('disabled', false); stage.getLayers()[0]!.draw();
    document.addEventListener('camp-ve:onezone-zone-request', event => {
      const request = JSON.parse((event as CustomEvent<string>).detail);
      if (request.choose?.zoneId === 'ga-a') node.setAttr('disabled', ++host.failedChoices <= 6);
      else if (!request.choose) node.setAttr('disabled', false);
    }, true);
  });
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  expect(await page.evaluate(() => (window as unknown as { failedChoices: number }).failedChoices)).toBe(7);
  await expect(page.locator('main form')).toContainText('GA A · 2 vé');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
});

test('giữ vé phản hồi muộn: không camp hoặc lưu lại để gửi lặp; checkout tới muộn vẫn nhận kể cả ẩn panel', async () => {
  await booking({ groupedLegend: true });
  await page.evaluate(() => document.addEventListener('click', event => {
    if (!(event.target as HTMLElement).closest('button[data-id="btn-continue"]')) return;
    event.stopImmediatePropagation();
    const main = document.querySelector('main')!;
    main.setAttribute('data-advances', String(Number(main.getAttribute('data-advances') ?? 0) + 1));
    (window as unknown as { finishDelayedHold(): void }).finishDelayedHold = () => {
      document.querySelector('#modal-host')!.innerHTML = '<h1>Thanh toán</h1><form><p>GA B · 2 vé</p><button type="button">Xác nhận đơn hàng</button></form>';
    };
  }, true));
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'ADVANCING');
  const worker = context.serviceWorkers()[0]!;
  const originalId = await worker.evaluate(async () => {
    const key = 'ticket-assistant.auto.session.v1', run = (await chrome.storage.session.get(key))[key];
    run.progress.actionAt = Date.now() - 16000;
    await chrome.storage.session.set({ [key]: run }); await chrome.tabs.sendMessage(run.tabId, { type: 'AUTO_UPDATED', run });
    return run.id;
  });
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'PAUSED');
  await expect(page.locator('.auto-status').getByRole('button', { name: 'Bắt đầu camp', exact: true })).toHaveCount(0);
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
  await popup.getByRole('button', { name: 'Kiểm tra tab vé', exact: true }).click();
  const rejection = await popup.evaluate(async () => {
    const config = (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1'];
    return { start: await chrome.runtime.sendMessage({ type: 'AUTO_START' }), save: await chrome.runtime.sendMessage({ type: 'SAVE', preferences: config.preferences }) };
  });
  expect(rejection.start.error).toContain('chưa rõ kết quả'); expect(rejection.save.error).toContain('chưa rõ kết quả');
  await page.getByRole('button', { name: 'Ẩn panel', exact: true }).click();
  await page.evaluate(() => (window as unknown as { finishDelayedHold(): void }).finishDelayedHold());
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'].progress.phase)).toBe('CHECKOUT');
  expect(await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'].id)).toBe(originalId);
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
  await expect(page.getByRole('button', { name: 'Xác nhận đơn hàng', exact: true })).toBeVisible();
});

test('khu ưu tiên hết rồi trả lại: giữ camp, đọc mới Konva không cần reload trang chọn vé', async () => {
  await booking({ groupedLegend: true });
  const changeStock = (disabled: boolean) => {
    const K = (window as unknown as { Konva: { stages: { find(selector: string): { getAttr(name: string): string; setAttr(name: string, value: boolean): void }[] }[] } }).Konva;
    K.stages[0]!.find('.seat').find(node => node.getAttr('zoneId') === 'ga-b')!.setAttr('disabled', disabled);
  };
  await page.evaluate(changeStock, true);
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toContainText('Chờ vé ưu tiên');
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await page.evaluate(changeStock, false);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('GA B · 2 vé');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
});

test('khu vừa bấm đã hết vé trước modal: tự chọn khu khác, không lặp yêu cầu giữ vé', async () => {
  await booking({ groupedLegend: true });
  await page.evaluate(() => {
    const K = (window as unknown as { Konva: { stages: { find(selector: string): { getAttr(name: string): string; setAttr(name: string, value: boolean): void; on(name: string, handler: (event: { cancelBubble: boolean }) => void): void }[]; getLayers(): { draw(): void }[] }[] } }).Konva;
    const stage = K.stages[0]!, node = stage.find('.seat').find(n => n.getAttr('zoneId') === 'ga-a')!;
    node.setAttr('disabled', false);
    node.on('click', event => { event.cancelBubble = true; node.setAttr('disabled', true); stage.getLayers()[0]!.draw(); });
    stage.getLayers()[0]!.draw();
  });
  await expect(page.locator('.recommendation').first()).toContainText('GA A');
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('GA B · 2 vé');
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
});

test('khu khóa ngay giữa kiểm tra và click: nhận lỗi trước giữ vé rồi chuyển khu', async () => {
  await booking({ groupedLegend: true });
  await page.evaluate(() => {
    const K = (window as unknown as { Konva: { stages: { find(selector: string): { getAttr(name: string): string; setAttr(name: string, value: boolean): void }[]; getLayers(): { draw(): void }[] }[] } }).Konva;
    const stage = K.stages[0]!, node = stage.find('.seat').find(n => n.getAttr('zoneId') === 'ga-a')!;
    node.setAttr('disabled', false); stage.getLayers()[0]!.draw();
    document.addEventListener('camp-ve:onezone-zone-request', event => {
      const request = JSON.parse((event as CustomEvent<string>).detail);
      if (request.choose?.zoneId === 'ga-a') { node.setAttr('disabled', true); stage.getLayers()[0]!.draw(); }
    }, true);
  });
  await expect(page.locator('.recommendation').first()).toContainText('GA A');
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('GA B · 2 vé');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
});

for (const mode of ['correct', 'wrong'] as const) test(`bước mua kèm: ${mode === 'correct' ? 'tự tiếp tục tới thanh toán' : 'tổng tiền khác vé phải dừng'}`, async () => {
  await booking({ groupedLegend: true, addons: mode });
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', mode === 'correct' ? 'CHECKOUT' : 'PAUSED', { timeout: 20000 });
  if (mode === 'correct') await expect(page.getByRole('button', { name: 'Xác nhận đơn hàng' })).toBeVisible();
  else await expect(page.locator('footer button')).toHaveText('Tiếp tục');
});

test('thẻ giá chỉ ghi tên hạng chung: chọn đúng khu khả dụng rồi xác nhận modal', async () => {
  await booking({ groupedLegend: true });
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('GA B · 2 vé');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
});

for (const scope of ['one', 'all'] as const) test(`giá ${scope === 'one' ? 'một khu đổi: chờ khu khác đúng giá' : 'tất cả khu đổi: dừng trước khi chọn'}`, async () => {
  await booking();
  const prices = page.locator('main p').filter({ hasText: 'đ900.000' });
  if (scope === 'one') await prices.last().evaluate(p => { p.textContent = 'đ950.000'; });
  else await prices.evaluateAll(items => items.forEach(p => { p.textContent = 'đ950.000'; }));
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', scope === 'one' ? 'READY' : 'PAUSED');
  await expect(page.locator('main')).not.toHaveAttribute('data-selections');
  await expect(page.locator('main')).not.toHaveAttribute('data-advances');
  if (scope === 'one') {
    await page.evaluate(() => {
      const K = (window as unknown as { Konva: { stages: { find(selector: string): { getAttr(name: string): string; setAttr(name: string, value: boolean): void }[]; getLayers(): { draw(): void }[] }[] } }).Konva;
      K.stages[0]!.find('.seat').find(node => node.getAttr('zoneId') === 'ga-a')!.setAttr('disabled', false);
      K.stages[0]!.getLayers()[0]!.draw();
    });
    await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
    await expect(page.locator('main form')).toContainText('GA A · 2 vé');
    await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
    await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
  }
});

test('Konva đổi trạng thái khu không đổi DOM: redraw đánh thức camp đang chờ', async () => {
  await booking();
  const changeAvailability = (disabled: boolean) => page.evaluate(disabled => {
    const K = (window as unknown as { Konva: { stages: { find(selector: string): { getAttr(name: string): string; setAttr(name: string, value: boolean): void }[]; getLayers(): { draw(): void }[] }[] } }).Konva;
    const stage = K.stages[0]!;
    stage.find('.seat').find(n => n.getAttr('zoneId') === 'ga-b')!.setAttr('disabled', disabled);
    stage.getLayers()[0]!.draw();
  }, disabled);
  await changeAvailability(true);
  await expect(page.locator('.recommendation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await expect(page.locator('main')).not.toHaveAttribute('data-selections');
  await changeAvailability(false);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
});

test('modal xác minh: chờ quá 5 giây, iframe còn hiện sau khi nút mở vẫn tiếp tục đúng vé', async () => {
  await booking({ verification: true });
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.status-line')).toContainText('Cần xác minh');
  await expect(page.locator('.auto-status')).toContainText('Chờ xác minh');
  await page.waitForTimeout(5500);
  await expect(page.getByRole('button', { name: 'Dừng camp', exact: true })).toBeEnabled();
  await expect(page.locator('main')).not.toHaveAttribute('data-advances');
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/konva-verification.png' });
  await page.getByRole('button', { name: 'Xác minh xong · mô phỏng', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('GA B · 2 vé');
});

for (const wrong of [false, true]) test(`modal đã chọn bằng tay: ${wrong ? 'FANZONE khác GA phải dừng' : 'GA đúng ưu tiên được tiếp tục'}`, async () => {
  await booking();
  await page.evaluate(wrong => {
    const K = (window as unknown as { Konva: { stages: { find(selector: string): { getAttr(name: string): string; fire(name: string, event: object, bubble: boolean): void }[] }[] } }).Konva;
    const node = K.stages[0]!.find('.seat').find(n => n.getAttr('zoneId') === (wrong ? 'fan-a' : 'ga-b'))!;
    node.fire('click', { evt: new MouseEvent('click') }, true);
  }, wrong);
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', wrong ? 'PAUSED' : 'CHECKOUT');
  if (wrong) await expect(page.locator('main')).not.toHaveAttribute('data-advances');
  else await expect(page.locator('main form')).toContainText('GA B · 2 vé');
});
