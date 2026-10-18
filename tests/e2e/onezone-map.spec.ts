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
  const extension = resolve('.output/chrome-mv3');
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

async function booking(verification = false, groupedLegend = false, addons: 'correct' | 'wrong' | false = false) {
  const konva = readFileSync('node_modules/konva/konva.min.js', 'utf8');
  await context.route(/^https:\/\/ticket\.1zone\.vn\//, route => {
    if (new URL(route.request().url()).pathname === '/fixture-konva.js') return route.fulfill({ contentType: 'application/javascript', body: konva });
    if (new URL(route.request().url()).pathname === '/checkout/add-ons') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><h1>Vé mua kèm</h1><section><h2>Vé của bạn · Demo</h2><p>21/11/2030 · GA × 2 · đ900.000</p></section><article>Poster · đ99.000</article><footer><b>đ${addons === 'wrong' ? '1.899.000' : '1.800.000'}</b><button onclick="document.body.innerHTML='<h1>Thanh toán</h1><form><button type=button>Xác nhận đơn hàng</button></form>'">Tiếp tục</button></footer>` });
    const legend = groupedLegend ? '<div><p>GA</p><p>đ900.000</p></div>' : '<div><p>GA A</p><p>đ900.000</p></div><div><p>GA B</p><p>đ900.000</p></div>';
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><main><h1>Chọn khu vực</h1><div id="seatmap-container-event-test-fixture" style="width:400px;height:220px"></div>${legend}<div><p>FANZONE A</p><p>đ1.500.000</p></div><div id="modal-host"></div></main><script src="/fixture-konva.js"></script><script>(${installOnezoneMapDemo.toString()})(document,${verification},${!!addons})</script>` });
  });
  page = await context.newPage(); await page.goto(catalogUrl.replace('/events/', '/booking/') + '?calendarId=HN');
  await expect(page.locator('.status-line')).toContainText('Đang chọn vé');
  await expect(page.locator('.recommendation')).toContainText('GA B');
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

for (const mode of ['correct', 'wrong'] as const) test(`bước mua kèm: ${mode === 'correct' ? 'tự tiếp tục tới thanh toán' : 'tổng tiền khác vé phải dừng'}`, async () => {
  await booking(false, true, mode);
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', mode === 'correct' ? 'CHECKOUT' : 'PAUSED', { timeout: 20000 });
  if (mode === 'correct') await expect(page.getByRole('button', { name: 'Xác nhận đơn hàng' })).toBeVisible();
  else await expect(page.locator('footer button')).toHaveText('Tiếp tục');
});

test('thẻ giá chỉ ghi tên hạng chung: chọn đúng khu khả dụng rồi xác nhận modal', async () => {
  await booking(false, true);
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('GA B · 2 vé');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
});

test('giá trên thẻ đã đổi: không chọn khu hoặc bấm tiếp', async () => {
  await booking();
  await page.locator('main p').filter({ hasText: 'đ900.000' }).last().evaluate(p => { p.textContent = 'đ950.000'; });
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'PAUSED');
  await expect(page.locator('main')).not.toHaveAttribute('data-selections');
  await expect(page.locator('main')).not.toHaveAttribute('data-advances');
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
  await booking(true);
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
