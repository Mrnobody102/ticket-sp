import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calendar, catalogUrl, eventData, flightHtml, searchItem, ticketData, ticketReply, ticketboxReply, ticketboxUrl } from '../fixtures/catalog';
import { installBookingDemo } from '../../src/testing/booking-demo';
import { installOnezoneDemo } from '../../src/testing/onezone-demo';
import { HANOI_PRESET } from '../../src/core/task-presets';

let context: BrowserContext;
let worker: Worker;
let extensionId: string;
const errors: string[] = [];
type Mock = { path: string; body: unknown; text?: boolean; delay?: number; status?: number };
const defaults = (): Mock[] => [
  { path: '/v2/marketplace/search?', body: { errorCode: 0, data: { ticketEvents: [searchItem] } } },
  { path: '/events/catalog-test', body: flightHtml(), text: true },
  { path: '/get-summary-event/event-test?', body: ticketReply() },
  { path: '/search/v3/events?', body: { code: 200, data: { results: [{ id: 26657, name: 'Ticketbox thử nghiệm', deeplink: ticketboxUrl, day: calendar().startDate }], total: { filtered: 1 } } } },
  { path: '/gin/api/v2/events/26657', body: ticketboxReply() },
];
async function mockCatalog(mocks = defaults()) {
  await worker.evaluate(data => {
    const host = globalThis as unknown as { catalogLog: { url: string; method?: string; credentials?: string }[] };
    host.catalogLog = [];
    globalThis.fetch = async (input, options) => {
      const url = String(input); host.catalogLog.push({ url, method: options?.method, credentials: options?.credentials });
      const mock = data.find(m => url.includes(m.path));
      if (!mock) throw new Error(`Unexpected catalog URL: ${url}`);
      if (mock.delay) await new Promise(resolve => setTimeout(resolve, mock.delay));
      return new Response(mock.text ? String(mock.body) : JSON.stringify(mock.body), { status: mock.status ?? 200, headers: { 'Content-Type': mock.text ? 'text/html' : 'application/json' } });
    };
  }, mocks);
}
test.beforeEach(async () => {
  errors.length = 0;
  const extensionPath = resolve('.output/chrome-mv3');
  context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
  mkdirSync('artifacts', { recursive: true });
  await mockCatalog();
});
test.afterEach(async () => { await context.close(); expect(errors).toEqual([]); });
async function workspace() { const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/workspace.html`); return page; }
async function selectEvent(page: Awaited<ReturnType<typeof workspace>>) {
  await page.getByLabel('Tìm concert', { exact: true }).fill('Vương Bình');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.locator('.event-result').click();
  await expect(page.getByLabel('Thêm hạng vé ưu tiên')).toBeVisible();
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption('vip-test');
  await page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)').fill('2020-01-01T00:00');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
}

test('tìm → chọn đúng hạng/giá → lưu ID → camp tới checkout với số vé mặc định 1', async () => {
  const body = readFileSync('fixtures/booking.html', 'utf8') + `<script>(${installBookingDemo.toString()})(document)</script>`;
  await context.route(/^https:\/\/ticket\.1zone\.vn\//, route => route.fulfill({ contentType: 'text/html', body }));
  const page = await workspace(); await selectEvent(page);
  // An already loaded site tab also makes navigation deterministic in extension-driven tests.
  const event = await context.newPage(); await event.goto(catalogUrl + '?calendarId=HN');
  await expect(event.locator('.status-line')).toContainText('Đang chọn vé');
  await expect(page.getByLabel('Link concert')).toHaveValue(catalogUrl + '?calendarId=HN');
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveValue('1');
  const stored = await worker.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1']);
  expect(stored.preferences.catalog.tickets).toEqual([{ id: 'vip-test', name: 'VIP', priceVnd: 1200000, seatMode: 'AUTO', maxQuantity: 2 }]);
  await page.locator('.setup-form').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/workspace-catalog.png', fullPage: true });
  await page.getByLabel('Số vé', { exact: true }).fill('2');
  await expect(page.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toBeDisabled();
  await page.getByLabel('Số vé', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect.poll(() => worker.evaluate(async () => {
    const run = (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'];
    return run?.progress.phase === 'PAUSED' ? run.progress.message : run?.progress.phase;
  }), { message: 'Catalog run must reach checkout without URL/performance drift' }).toBe('CHECKOUT');
  const log = await worker.evaluate(() => (globalThis as unknown as { catalogLog: { method?: string; credentials?: string }[] }).catalogLog);
  expect(log.every(r => r.method === 'GET' && r.credentials === 'omit')).toBe(true);
  expect(log).toHaveLength(5); // search, detail, tiers, and fresh detail+tiers before arming.
});

for (const state of ['event', 'booking'] as const) test(`mở sẵn ${state} trước cấu hình: popup dùng đúng tab/suất, không mở trùng, tới checkout một lần`, async () => {
  const target = catalogUrl + '?calendarId=HN';
  const booking = target.replace('/events/', '/booking/');
  const bookingBody = readFileSync('fixtures/booking.html', 'utf8') + `<script>(${installBookingDemo.toString()})(document)</script>`;
  const eventBody = '<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body><main><h1>Sắp mở bán</h1><button data-id="btn-by-ticket" disabled>Sắp mở bán</button><h2>Thanh toán thế nào?</h2><form><input aria-label="Email nhận tin"></form></main></body></html>';
  await context.route(/^https:\/\/ticket\.1zone\.vn\//, route => route.fulfill({ contentType: 'text/html', body: new URL(route.request().url()).pathname.startsWith('/booking/') ? bookingBody : eventBody }));
  // A tab of the same event but another calendar must never receive this run.
  const other = await context.newPage(); await other.goto(catalogUrl + '?calendarId=OTHER');
  const existing = await context.newPage(); await existing.goto(state === 'event' ? target : booking);
  await expect(existing.locator('[data-ticket-assistant]')).toHaveCount(1);
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({ url: 'https://ticket.1zone.vn/*' })).find(tab => tab.url === url)!.id!, existing.url());
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await selectEvent(page);
  const pageCount = context.pages().length;
  const actions: string[] = [];
  await context.exposeBinding('recordBookingAction', (_source, label: string) => { actions.push(label); });
  const audit = () => document.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('main button');
    if (button) void (window as unknown as { recordBookingAction(label: string): Promise<void> }).recordBookingAction(button.textContent ?? '');
  }, true);
  await context.addInitScript(audit);
  await existing.evaluate(audit);
  if (state === 'event') {
    await existing.evaluate(url => {
      document.querySelector('main button')!.addEventListener('click', () => { location.href = url; });
    }, booking);
  }
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  if (state === 'event') {
    await expect(existing.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
    await expect(existing).toHaveURL(target);
    await existing.evaluate(() => {
      document.querySelector('main h1')!.textContent = 'Giới thiệu sự kiện';
      const button = document.querySelector<HTMLButtonElement>('[data-id="btn-by-ticket"]')!;
      button.textContent = 'Mua vé'; button.disabled = false;
    });
  }
  await expect(existing.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(existing.locator('main form')).toContainText('VIP · 1 vé');
  const run = await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  expect(run.tabId).toBe(tabId);
  expect(context.pages()).toHaveLength(pageCount);
  await expect(other).toHaveURL(catalogUrl + '?calendarId=OTHER');
  await expect(other.getByRole('button', { name: 'Dừng camp', exact: true })).toHaveCount(0);
  await expect.poll(() => actions).toEqual(state === 'event' ? ['Mua vé', 'Chọn', 'Tiếp tục'] : ['Chọn', 'Tiếp tục']);
});

test('giá đổi trước khi bật camp: dừng trước khi mở/giữ vé', async () => {
  const page = await workspace(); await selectEvent(page);
  const mocks = defaults(); mocks[2]!.body = ticketReply([{ ...ticketData, finalPriceVn: 1300000 }]); await mockCatalog(mocks);
  const count = context.pages().length;
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('giá đã đổi');
  expect(context.pages()).toHaveLength(count);
  expect(await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'])).toBeUndefined();
});

test('đóng popup giữ bản nháp tìm kiếm, hạng, thứ tự và ô nhập; chưa đổi cấu hình chạy', async () => {
  const mocks = defaults(); mocks[2]!.body = ticketReply([ticketData, { ...ticketData, ticketClassId: 'regular-test', name: 'REGULAR', finalPriceVn: 800000 }]); await mockCatalog(mocks);
  const openPopup = async () => { const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/popup.html`); return page; };
  let page = await openPopup();
  await page.getByLabel('Tìm concert', { exact: true }).fill('Vương Bình');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await expect(page.locator('.event-result')).toHaveCount(1);
  await page.close();
  page = await openPopup();
  await expect(page.getByLabel('Tìm concert', { exact: true })).toHaveValue('Vương Bình');
  await expect(page.locator('.event-result')).toHaveCount(1);
  await page.locator('.event-result').click();
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption('vip-test');
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption('regular-test');
  await page.getByRole('button', { name: 'Tăng ưu tiên REGULAR', exact: true }).click();
  await page.getByLabel('Cách bắt đầu camp').selectOption('IMMEDIATE');
  await page.locator('.extra-settings > summary').click();
  await page.getByLabel('Tổng ngân sách (VNĐ)', { exact: true }).fill('3000000');
  await page.getByLabel('Số vé', { exact: true }).fill('2');
  await page.close(); // No wait for storage: edit handlers must dispatch persistence themselves.
  page = await openPopup();
  await expect(page.getByLabel('Cách bắt đầu camp')).toHaveValue('IMMEDIATE');
  await expect(page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)')).toHaveCount(0);
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('Tổng ngân sách (VNĐ)', { exact: true })).toHaveValue('3000000');
  await expect(page.locator('.ticket-priorities li b')).toHaveText(['REGULAR', 'VIP']);
  await expect(page.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toBeDisabled();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1'])).toBeUndefined();
  expect(await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'])).toBeUndefined();
  await page.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.booking-draft.v1'))['ticket-assistant.booking-draft.v1'])).toBeUndefined();
  const saved = await worker.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1']);
  expect(saved.preferences).toMatchObject({ startMode: 'IMMEDIATE', quantity: 2, maxTotalVnd: 3000000 });
  await page.close(); page = await openPopup();
  await expect(page.getByLabel('Cách bắt đầu camp')).toHaveValue('IMMEDIATE');
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveValue('2');
  await expect(page.locator('.saved-tickets li')).toHaveCount(2);
});

test('show đã mở mặc định camp ngay, không nhập ngày giờ và đi tới checkout', async () => {
  const mocks = defaults(); mocks[1]!.body = flightHtml({ ...eventData, status: 'OPEN', canPurchase: true }); await mockCatalog(mocks);
  const body = readFileSync('fixtures/booking.html', 'utf8') + `<script>(${installBookingDemo.toString()})(document)</script>`;
  await context.route(/^https:\/\/ticket\.1zone\.vn\//, route => route.fulfill({ contentType: 'text/html', body }));
  const page = await workspace();
  await page.getByLabel('Tìm concert', { exact: true }).fill('Vương Bình');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click(); await page.locator('.event-result').click();
  await expect(page.getByLabel('Cách bắt đầu camp')).toHaveValue('IMMEDIATE');
  await expect(page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)')).toHaveCount(0);
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption('vip-test');
  await page.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  expect(await worker.evaluate(async () => (await chrome.alarms.getAll()).length)).toBe(0);
  // Attach the intercepted site before extension-driven navigation; otherwise
  // Chromium may start a real Next page before Playwright attaches its route.
  const event = await context.newPage(); await event.goto(catalogUrl + '?calendarId=HN');
  await expect(event.locator('.status-line')).toContainText('Đang chọn vé');
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']?.progress.phase)).toBe('CHECKOUT');
});

test('bản nháp khi đang camp không sửa số vé hoặc hủy phiên đang chạy', async () => {
  await context.route(/^https:\/\/ticket\.1zone\.vn\//, route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta charset="utf-8"><h1>Sắp mở bán</h1><button data-id="btn-by-ticket" disabled>Sắp mở bán</button>' }));
  let page = await workspace(); await selectEvent(page);
  const event = await context.newPage(); await event.goto(catalogUrl + '?calendarId=HN');
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  const before = await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  await page.getByLabel('Số vé', { exact: true }).fill('2'); await page.close();
  page = await workspace();
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Dừng camp', exact: true })).toBeEnabled();
  const actual = await worker.evaluate(async () => ({ run: (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'],
    config: (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1'] }));
  expect(actual.config.preferences.quantity).toBe(1);
  expect(actual.run.id).toBe(before.id);
  expect(actual.run.progress.phase).toBe('READY');
});

test('cấu hình nhanh Hà Nội tự điền link, 12h và 1 vé; chỉ chọn hạng rồi lưu, chưa tự arm', async () => {
  const mocks = defaults();
  mocks.unshift({ path: '/events/vuong-binh-tiec-thanh-than-mam-2', body: flightHtml({ ...eventData, id: 'aAq6NT', pathName: 'vuong-binh-tiec-thanh-than-mam-2', eventCalendar: [{ ...calendar('8h0YGm'), eventId: 'aAq6NT' }] }), text: true });
  mocks.unshift({ path: '/get-summary-event/aAq6NT?', body: ticketReply([{ ...ticketData, eventId: 'aAq6NT', calendarId: '8h0YGm' }]) });
  await mockCatalog(mocks);
  const page = await workspace();
  await expect(page.locator('.target-shortcut strong')).toHaveText(HANOI_PRESET.title);
  await page.getByRole('button', { name: `Chuẩn bị ${HANOI_PRESET.title}` }).click();
  await expect(page.getByLabel('Link concert')).toHaveValue(HANOI_PRESET.eventUrl);
  await expect(page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)')).toHaveValue('2026-10-18T12:00');
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveValue('1');
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption('vip-test');
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveAttribute('max', '2');
  await page.getByLabel('Số vé', { exact: true }).fill('3');
  expect(await page.getByLabel('Số vé', { exact: true }).evaluate((e: HTMLInputElement) => e.validity.rangeOverflow)).toBe(true);
  await page.getByLabel('Số vé', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  const saved = await worker.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1']);
  expect(saved.preferences.refreshAtSale).toBe(true); expect(saved.preferences.maxTotalVnd).toBeUndefined();
  expect(await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'])).toBeUndefined();
  await page.reload();
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveAttribute('max', '2');
  await expect(page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)')).toHaveValue('2026-10-18T12:00');
  await expect(page.locator('.saved-tickets')).toContainText('VIP');
  await page.locator('.setup-form').evaluate(e => { e.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/hanoi-preset.png', fullPage: true });
});

test('thẻ tiêu đề p → modal 1Zone → số lượng span 2 vé → checkout', async () => {
  const mocks = defaults(); mocks[2]!.body = ticketReply([{ ...ticketData, name: 'HAI QUÝ - EB', zoneName: 'HAI QUÝ 2', finalPriceVn: 2996000 }]); await mockCatalog(mocks);
  // Booking cards may use zoneName; the quantity modal can use the ticket name.
  const body = readFileSync('fixtures/onezone-modal.html', 'utf8').replaceAll('HAI QUÝ - EB', 'HAI QUÝ 2') + `<script>(${installOnezoneDemo.toString()})(document)</script>`;
  await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html', body }));
  const page = await workspace(); await selectEvent(page);
  await page.getByLabel('Số vé', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  const event = await context.newPage(); await event.goto(catalogUrl + '?calendarId=HN');
  await expect(event.locator('.status-line')).toContainText('Đang chọn vé');
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('#modal-host form')).toContainText('HAI QUÝ - EB · 2 vé');
  await expect(event.getByRole('button', { name: 'Xác nhận đơn hàng', exact: true })).toBeVisible();
});

test('một hạng gồm nhiều zone: chọn khu đúng ID/giá, modal xác nhận khu, 2 vé tới checkout', async () => {
  const mocks = defaults();
  mocks[2]!.body = ticketReply([{ ...ticketData, name: 'HAI QUÝ - EB', zoneName: 'HAI QUÝ 2', ticketType: 'seatmap_zone', finalPriceVn: 2996000 }]);
  mocks.unshift({ path: '/get-summary-event/event-test/zones?', body: { errorCode: 0, data: [1, 2].map(index => ({
    id: `zone-${index}`, name: `HAI QUÝ ${index}`, ticketClassId: 'vip-test', eventId: 'event-test', calendarId: 'HN',
  })) } });
  await mockCatalog(mocks);
  const body = readFileSync('fixtures/onezone-modal.html', 'utf8').replaceAll('HAI QUÝ - EB', 'HAI QUÝ 1')
    .replace('</button></div></div>', '</button></div><div class="ticket-card"><p>HAI QUÝ 2</p><p>2.996.000 ₫</p><button disabled>Chọn</button></div></div>')
    + `<script>(${installOnezoneDemo.toString()})(document,{displayName:'HAI QUÝ 1'})</script>`;
  await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html', body }));
  const page = await workspace(); await selectEvent(page);
  await page.getByLabel('Số vé', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  const stored = await worker.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1']);
  expect(stored.preferences.catalog.tickets[0].zones).toEqual([{ id: 'zone-1', name: 'HAI QUÝ 1' }, { id: 'zone-2', name: 'HAI QUÝ 2' }]);
  const event = await context.newPage(); await event.goto(catalogUrl + '?calendarId=HN');
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('#modal-host form')).toContainText('HAI QUÝ 1 · 2 vé');
  const log = await worker.evaluate(() => (globalThis as unknown as { catalogLog: { url: string }[] }).catalogLog);
  expect(log.filter(request => request.url.includes('/zones?'))).toHaveLength(2); // Setup and preflight only.
});

for (const fault of ['modal-id', 'multiple-zones'] as const) test(`chọn xong gặp ${fault}: tạm dừng trước khi bấm đi thanh toán`, async () => {
  const mocks = defaults();
  mocks[2]!.body = ticketReply([{ ...ticketData, name: 'HAI QUÝ - EB', zoneName: 'HAI QUÝ 2', ticketType: 'seatmap_zone', finalPriceVn: 2996000 }]);
  mocks.unshift({ path: '/get-summary-event/event-test/zones?', body: { errorCode: 0, data: [1, 2].map(index => ({ id: `zone-${index}`, name: `HAI QUÝ ${index}`, ticketClassId: 'vip-test', eventId: 'event-test', calendarId: 'HN' })) } });
  await mockCatalog(mocks);
  const conflicting = '<main><h1>Chọn khu vực</h1>' + [1, 2].map(index => `<article><h3>HAI QUÝ ${index}</h3><p>2.996.000 ₫</p><button aria-pressed="true">Chọn</button></article>`).join('') + '<input type="number" aria-label="Số lượng" min="1" max="2" value="1"><button>Tiếp tục</button></main>';
  const body = readFileSync('fixtures/onezone-modal.html', 'utf8') + `<script>(${installOnezoneDemo.toString()})(document);
    window.advanceClicks = 0;
    document.addEventListener('click', e => { if (e.target.closest('button')?.textContent === 'Tiếp tục') window.advanceClicks++; }, true);
    document.querySelector('#ticket-list button').addEventListener('click', () => {
      if (${JSON.stringify(fault)} === 'modal-id') document.querySelector('[role="dialog"]').setAttribute('data-ticket-class-id', 'wrong-class');
      else document.querySelector('main').outerHTML = ${JSON.stringify(conflicting)};
    });</script>`;
  await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html', body }));
  const page = await workspace(); await selectEvent(page);
  const event = await context.newPage(); await event.goto(catalogUrl + '?calendarId=HN');
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'PAUSED');
  await expect(event.locator('.auto-status')).toContainText(fault === 'modal-id' ? 'Chưa xác minh' : 'nhiều lựa chọn');
  expect(await event.evaluate(() => (window as unknown as { advanceClicks: number }).advanceClicks)).toBe(0);
  await expect(event.locator('main form')).toHaveCount(0);
});

test('tải catalog lỗi: báo lỗi và thử lại để có select, không đưa ô nhập thủ công ra mặc định', async () => {
  const mocks = defaults(); mocks[1]!.status = 503; await mockCatalog(mocks);
  const page = await workspace();
  await page.getByLabel('Link concert').fill(catalogUrl + '?calendarId=HN');
  await page.getByRole('button', { name: 'Tải hạng vé', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('503');
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu cấu hình' })).toBeDisabled();
  await expect(page.getByLabel('Thêm hạng vé ưu tiên')).toHaveCount(0);
  await mockCatalog();
  await page.getByRole('button', { name: 'Tải hạng vé', exact: true }).click();
  await expect(page.getByLabel('Thêm hạng vé ưu tiên')).toBeVisible();
  await expect(page.getByLabel('Thêm hạng vé ưu tiên').locator('option')).toContainText(['Chọn hạng và giá vé', 'VIP · 1.200.000']);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveCount(0);
});

test('nhiều suất yêu cầu chọn; link sai calendarId không tự chuyển suất', async () => {
  const mocks = defaults(); mocks[1]!.body = flightHtml({ ...eventData, eventCalendar: [calendar(), calendar('HCM')] });
  mocks.unshift({ path: '/get-summary-event/event-test?type=group&calendarId=HCM', body: ticketReply([{ ...ticketData, calendarId: 'HCM' }]) }); await mockCatalog(mocks);
  const page = await workspace();
  await page.getByLabel('Link concert').fill(catalogUrl);
  await page.getByRole('button', { name: 'Tải chi tiết từ link', exact: true }).click();
  await expect(page.getByLabel('Suất diễn', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Thêm hạng vé ưu tiên')).toHaveCount(0);
  await page.getByLabel('Suất diễn', { exact: true }).selectOption('HN');
  await expect(page.getByLabel('Thêm hạng vé ưu tiên')).toBeVisible();
  await page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)').fill('2026-10-18T12:00');
  await page.getByLabel('Số vé', { exact: true }).fill('2');
  await page.getByLabel('Suất diễn', { exact: true }).selectOption('HCM');
  await expect(page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)')).toHaveValue('');
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveValue('1');
  await page.locator('.event-link > summary').click();
  await page.getByLabel('Link concert').fill(catalogUrl + '?calendarId=invalid');
  await page.getByRole('button', { name: 'Tải chi tiết từ link', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Suất trong link');
  await expect(page.getByLabel('Suất diễn', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Thêm hạng vé ưu tiên')).toHaveCount(0);
});

test('nguồn Ticketbox hiển thị giá thật từ schema, không gắn adapter camp chưa có', async () => {
  const page = await workspace();
  await page.getByLabel('Nguồn sự kiện').selectOption('ticketbox');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.locator('.event-result').click();
  await expect(page.locator('.ticket-preview')).toContainText('2.000.000');
  await expect(page.locator('.ticket-preview li').first()).toBeInViewport();
  await page.getByRole('button', { name: 'Đổi sự kiện' }).click();
  await expect(page.locator('.event-result')).toBeVisible();
  await page.locator('.event-result').click();
  await expect(page.locator('.ticket-preview')).toContainText('2.000.000');
  await expect(page.locator('.source-note')).toContainText('chưa được xác minh');
  await expect(page.getByLabel('Link concert')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toBeDisabled();
});

test('kết quả chậm không ghi đè tìm kiếm mới; popup không tràn ngang, nút camp luôn thấy', async () => {
  const mocks = defaults(); mocks.unshift({ path: 'keyword=old', body: { errorCode: 0, data: { ticketEvents: [{ ...searchItem, name: 'Old result' }] } }, delay: 800 });
  await mockCatalog(mocks);
  const page = await context.newPage(); await page.setViewportSize({ width: 460, height: 600 }); await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByLabel('Tìm concert', { exact: true }).fill('old');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.getByLabel('Tìm concert', { exact: true }).fill('new');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await expect(page.locator('.event-result')).toContainText(eventData.name);
  await expect.poll(() => worker.evaluate(() => (globalThis as unknown as { catalogLog: unknown[] }).catalogLog.length)).toBe(2);
  await page.waitForTimeout(900);
  await expect(page.locator('.event-result')).not.toContainText('Old result');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'artifacts/popup-search.png' });
  await page.locator('.event-result').click();
  await expect(page.getByLabel('Thêm hạng vé ưu tiên')).toBeInViewport();
  await expect(page.getByLabel('Số vé', { exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Lưu cấu hình' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toBeInViewport();
  await expect(page.getByRole('heading', { name: eventData.name, exact: true })).toHaveCount(1);
  await page.screenshot({ path: 'artifacts/popup-booking.png' });
});
