import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { capitaneusEvent, capitaneusTypes, capitaneusUrl, capitaneusZones } from '../fixtures/capitaneus';
import { flightHtml } from '../fixtures/catalog';
import { installOnezoneSeatsDemo } from '../../src/testing/onezone-seats-demo';

let context: BrowserContext;
const errors: string[] = [];
test.afterEach(async () => { await context?.close(); expect(errors).toEqual([]); });
const inventory = capitaneusTypes.flatMap(t => ['A', 'B'].flatMap(rowName => Array.from({ length: 6 }, (_, i) => ({
  _id: `${t.ticketClassId}-${rowName}-${i + 1}`, eventId: 'kAapup', calendarId: 'XDacU6', ticketClassId: t.ticketClassId, zoneId: t.referenceId,
  zoneName: t.name, rowName, code: String(i + 1), priceVnd: t.finalPriceVn,
}))));

async function booking(tier = capitaneusTypes[0]!, quantity = 2, options: Parameters<typeof installOnezoneSeatsDemo>[1] = {}, queue = false) {
  errors.length = 0;
  const extension = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(async ({ html, types, zones, tier, quantity }) => {
    globalThis.fetch = async input => new Response(String(input).includes('/events/') ? html : JSON.stringify({ errorCode: 0, data: String(input).includes('/zones?') ? zones : types }));
    await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
      preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6', saleStartAt: '2026-01-01T00:00:00Z', startMode: 'IMMEDIATE', quantity, preferredZoneLabels: [tier.name], allowAlternatives: false,
        catalog: { eventId: 'kAapup', performanceId: 'XDacU6', title: 'CAPITANEUS MUTABILIS', venue: 'Sân khấu C30 Hoà Bình, TP. HCM', startsAt: '2026-11-22T12:00:00.700Z', verifiedAt: Date.now(),
          tickets: [{ id: tier.ticketClassId, name: tier.name, priceVnd: tier.finalPriceVn, seatMode: 'AUTO', maxQuantity: 2, zones: [{ id: tier.referenceId, name: tier.name }] }] } } } });
  }, { html: flightHtml(capitaneusEvent), types: capitaneusTypes, zones: capitaneusZones, tier, quantity });
  await context.route('https://prod.1zone.vn/**', route => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ errorCode: 0, data: inventory }) }));
  const legend = capitaneusTypes.map(t => `<div><p>${t.name}</p><p>${t.finalPriceVn.toLocaleString('vi-VN')} ₫</p></div>`).join('');
  await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><main><h1>Chọn ghế</h1>${legend}<div id="seatio"><div style="height:100px"><iframe title="seating chart" srcdoc=""></iframe></div></div><div class="ticket-list-fixed-bar"></div></main><script>(${installOnezoneSeatsDemo.toString()})(document,${JSON.stringify(options)})</script>` }));
  const bookingUrl = capitaneusUrl.replace('/events/', '/booking/');
  await context.route('https://queue.1zone.vn/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><h1>Bạn đang trong hàng chờ</h1><a href="${bookingUrl}">Đến lượt · mô phỏng</a>` }));
  const page = await context.newPage(); await page.goto(queue ? 'https://queue.1zone.vn/?c=eventista&e=kaapup&t=' + encodeURIComponent(bookingUrl) : bookingUrl);
  await expect(page.locator('.status-line')).toContainText(queue ? 'Đang xếp hàng' : options.initialVerification ? 'Cần xác minh' : options.readHangAlways || options.readHangOnce ? 'Chưa nhận diện' : 'Đang chọn vé');
  return { page, worker };
}
async function start(page: Page) { await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click(); }

test('qua queue và xác minh đầu trang: tự tiếp tục chọn đúng ghế cuối rồi tới thanh toán', async () => {
  const { page } = await booking(undefined, 1, { initialVerification: true, onlyAvailableLabel: 'SUMMER-B-6' }, true);
  await start(page);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await page.getByRole('link', { name: 'Đến lượt · mô phỏng' }).click();
  await expect(page.locator('.status-line')).toContainText('Cần xác minh');
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await page.getByRole('button', { name: 'Xác minh xong · vào chọn ghế' }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('SUMMER-B-6');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).toHaveAttribute('data-holds', '1');
});

test('còn 1 ghế nhưng yêu cầu 2: báo thiếu số lượng, tiếp tục chờ và không tự đổi đơn', async () => {
  const { page } = await booking(undefined, 2, { onlyAvailableLabel: 'SUMMER-B-6' });
  await start(page);
  await expect(page.locator('.auto-status')).toContainText('Không đủ 2 ghế');
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await expect(page.locator('main')).not.toHaveAttribute('data-selections');
  await expect(page.locator('[data-ticket-assistant] .highlight')).toHaveCount(0);
});

test('SDK mất một phản hồi sau admission: hết timeout tự đọc lại và tới checkout', async () => {
  const { page } = await booking(undefined, 1, { readHangOnce: true });
  await start(page);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
});

test('SDK không phản hồi liên tục: hiện lỗi cụ thể, không đơ im lặng hoặc tự gửi chọn ghế', async () => {
  const { page } = await booking(undefined, 1, { readHangAlways: true });
  await start(page);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'PAUSED', { timeout: 15000 });
  await expect(page.locator('.auto-status')).toContainText('Sơ đồ không phản hồi sau 3 lần đọc');
  await expect(page.locator('main')).not.toHaveAttribute('data-selections');
  await page.evaluate(() => (window as unknown as { seatDemo: { resumeReads(): void } }).seatDemo.resumeReads());
  await start(page);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
});

for (const tier of capitaneusTypes) for (const quantity of [1, 2]) test(`Seats.io ${tier.name} × ${quantity}: tự chọn ghế đúng khu qua SDK, kiểm tra chip/giá rồi tới checkout`, async () => {
  const { page } = await booking(tier, quantity, { readViaXhr: quantity === 2 });
  await start(page);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText(`${tier.name} · ${quantity} vé`);
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).toHaveAttribute('data-holds', '1');
  expect(await page.evaluate(() => (window as unknown as { seatDemo: { paymentClicks: number } }).seatDemo.paymentClicks)).toBe(0);
});

test('ghế đổi tồn kho trước click: tự chọn nhóm khác cùng khu, không gửi lặp', async () => {
  const { page } = await booking();
  await page.evaluate(() => (window as unknown as { seatDemo: { disable(label: string): void } }).seatDemo.disable('SUMMER-A-3'));
  await start(page);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).not.toContainText('SUMMER-A-3');
  await expect(page.locator('main')).toHaveAttribute('data-holds', '1');
});

test('xác minh hơn 15 giây: giữ phiên, giải xong tự tới checkout và chỉ tạo đơn một lần', async () => {
  const { page, worker } = await booking(undefined, 2, { verification: true });
  await start(page);
  await expect(page.locator('.status-line')).toContainText('Cần xác minh');
  await expect(page.locator('.auto-status')).toContainText('Chờ xác minh');
  await worker.evaluate(async () => {
    const key = 'ticket-assistant.auto.session.v1', run = (await chrome.storage.session.get(key))[key];
    run.progress.actionAt -= 60000;
    await chrome.storage.session.set({ [key]: run }); await chrome.tabs.sendMessage(run.tabId, { type: 'AUTO_UPDATED', run });
  });
  await page.getByRole('button', { name: 'Xác minh xong · mô phỏng' }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main')).toHaveAttribute('data-holds', '1');
});

test('tổng tiền sai: dừng trước CTA tạo đơn', async () => {
  const { page } = await booking(undefined, 2, { wrongTotal: true });
  await start(page);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'PAUSED', { timeout: 10000 });
  await expect(page.locator('main')).not.toHaveAttribute('data-holds');
});

test('SDK lỗi không rõ kết quả: không chọn lặp hay gửi đơn', async () => {
  const { page } = await booking(undefined, 2, { rejectSelection: true });
  await start(page);
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'PAUSED');
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await expect(page.locator('main')).not.toHaveAttribute('data-holds');
});

test('dừng trong lúc SDK phản hồi chậm: không chuyển tới tạo đơn khi phản hồi muộn', async () => {
  const { page } = await booking(undefined, 2, { quantityDelay: 2000 });
  await start(page);
  await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
  await page.getByRole('button', { name: 'Dừng camp', exact: true }).click();
  await page.evaluate(() => (window as unknown as { seatDemo: { release(): void } }).seatDemo.release());
  await expect(page.locator('.ticket-scroll [aria-label="Remove ticket"]')).toHaveCount(2);
  await expect(page.locator('main')).not.toHaveAttribute('data-holds');
});
