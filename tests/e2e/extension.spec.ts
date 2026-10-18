import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBookingDemo } from '../../src/testing/booking-demo';

let context: BrowserContext;
let extensionId: string;
const fixture = (name: string) => readFileSync(resolve(`fixtures/${name}.html`), 'utf8');
const target = 'https://ticket.1zone.vn/events/e2e-test';
const errors: string[] = [];

test.beforeAll(async () => {
  const path = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
  mkdirSync('artifacts', { recursive: true });
});
test.afterAll(async () => { await context?.close(); });

async function configure(page: Page) {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByLabel('Link concert').fill(target);
  await page.getByLabel('Cách bắt đầu camp').selectOption('SCHEDULED');
  await page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)').fill('2026-10-18T12:00');
  await page.getByLabel('Số vé', { exact: true }).fill('1');
  await page.locator('.extra-settings > summary').click();
  await page.getByLabel('Nhập hạng vé thủ công', { exact: true }).check();
  await page.getByLabel('Hạng vé ưu tiên · mỗi dòng một hạng').fill('VIP\nKhu A');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
}

test('popup → lưu → khôi phục → content panel → DOM/SPA → dừng → ẩn/hiện', async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByLabel('Số vé', { exact: true })).toHaveValue('1');
  await configure(popup);
  await popup.screenshot({ path: 'artifacts/popup.png', fullPage: true });
  await popup.reload();
  await expect(popup.getByLabel('Số vé', { exact: true })).toHaveValue('1');
  await expect(popup.getByLabel('Link concert')).toHaveValue(target);
  await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html', body: fixture('zone') }));
  const event = await context.newPage();
  let bookingRequests = 0;
  event.on('request', request => { if (request.method() !== 'GET') bookingRequests++; });
  await event.goto(target);
  await expect(event.getByRole('complementary', { name: 'Trợ lý camp vé' })).toBeVisible();
  await expect(event.locator('[data-ticket-assistant]')).toHaveCount(1);
  await expect(event.locator('.recommendation')).toHaveCount(2);
  await expect(event.locator('.highlight')).toHaveCount(2);
  await event.reload();
  await expect(event.locator('.recommendation')).toHaveCount(2);
  await expect(event.locator('[data-ticket-assistant]')).toHaveCount(1);
  const tabCount = context.pages().length;
  await popup.locator('.display-settings > summary').click();
  await popup.getByRole('button', { name: 'Mở trang vé', exact: true }).click();
  await expect.poll(() => context.pages().length).toBe(tabCount);

  // Only read and highlight; no click or value is applied to the site's controls.
  await expect(event.locator('article button').first()).not.toHaveAttribute('aria-pressed', 'true');
  await event.evaluate(() => { document.querySelector('article button')?.setAttribute('disabled', ''); });
  await expect(event.locator('.recommendation')).toHaveCount(1);
  await event.evaluate(() => { history.pushState({}, '', '/events/another'); document.querySelector('h1')!.textContent = 'Sự kiện khác'; });
  await expect(event.locator('.reason')).toContainText('Chưa khớp');
  await expect(event.locator('.highlight')).toHaveCount(0);
  await event.evaluate(() => { history.pushState({}, '', '/events/e2e-test'); document.querySelector('h1')!.textContent = 'Fan meeting'; });
  await expect(event.locator('.recommendation')).toHaveCount(1);
  await context.route('https://ticket.1zone.vn/booking/**', route => route.fulfill({
    contentType: 'text/html',
    body: fixture('zone').replace(/([\d.]+) ₫/g, '<span>đ</span>$1'),
  }));
  await event.goto(target.replace('/events/', '/booking/'));
  await expect(event.locator('.event-match')).toContainText('Đúng link');
  await expect(event.locator('.recommendation')).toHaveCount(2);
  await expect(event.locator('.highlight')).toHaveCount(2);
  await context.route('https://ticket.1zone.vn/waiting-room', route => route.fulfill({ contentType: 'text/html', body: fixture('waiting') }));
  await event.goto('https://ticket.1zone.vn/waiting-room');
  await expect(event.locator('.status-line')).toContainText('Đang xếp hàng');
  await expect(event.locator('.reason')).toContainText('Chưa xác nhận');
  await expect(event.locator('.highlight')).toHaveCount(0);
  await event.goto(target.replace('/events/', '/booking/'));
  await expect(event.locator('.recommendation')).toHaveCount(2);
  await event.locator('.panel-tools > summary').click();
  await event.getByRole('button', { name: 'Tắt công cụ', exact: true }).click();
  await expect(event.locator('.status-line')).toContainText('Đã dừng');
  await expect(event.locator('.highlight')).toHaveCount(0);
  await event.getByRole('button', { name: 'Ẩn panel' }).click();
  await expect(event.getByRole('complementary')).toBeHidden();
  await expect(popup.getByLabel('Hiện bảng camp trên trang vé')).not.toBeChecked();
  await popup.getByLabel('Hiện bảng camp trên trang vé').check();
  await expect(event.getByRole('complementary')).toBeVisible();
  expect(bookingRequests).toBe(0);
});

test('nhãn ảnh thay đổi riêng thuộc tính alt được nhận diện lại', async () => {
  const popup = await context.newPage(); await configure(popup);
  await context.route('https://ticket.1zone.vn/booking/**', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body><main><h1>Chọn khu vực</h1><button><img alt="VIP" width="16" height="16" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E">1.200.000 ₫</button></main></body></html>' }));
  const event = await context.newPage(); await event.goto(target.replace('/events/', '/booking/'));
  await expect(event.locator('.recommendation')).toHaveCount(1);
  await event.locator('main img').evaluate(image => image.setAttribute('alt', 'GOLD'));
  await expect(event.locator('.recommendation')).toHaveCount(0);
  await event.locator('main img').evaluate(image => image.setAttribute('alt', 'VIP'));
  await expect(event.locator('.recommendation')).toHaveCount(1);
});

test('demo chuyển đủ trạng thái; không ghi đè concert thật', async () => {
  const popup = await context.newPage();
  await configure(popup);
  const demo = await context.newPage();
  await demo.goto(`chrome-extension://${extensionId}/demo.html`);
  const frame = demo.frameLocator('iframe[title="Giao diện concert mô phỏng"]');
  await expect(demo.getByRole('button', { name: 'Chạy thử', exact: true })).toBeEnabled();
  await demo.screenshot({ path: 'artifacts/demo.png', fullPage: true });
  await demo.getByText('Kiểm tra nhận diện màn hình', { exact: true }).click();
  for (const [label, state] of [['Ghế tự cấp', 'Đang chọn vé'], ['Chọn ghế', 'Đang chọn vé'], ['Phòng chờ', 'Đang xếp hàng'], ['Xác minh', 'Cần xác minh'], ['Thanh toán', 'Thanh toán'], ['Canvas', 'Chưa nhận diện']] as const) {
    await demo.getByLabel('Màn hình', { exact: true }).selectOption({ label });
    await expect(frame.locator('.status-line')).toContainText(state);
    if (label !== 'Ghế tự cấp' && label !== 'Chọn ghế') await expect(frame.locator('.highlight')).toHaveCount(0);
  }
  await popup.reload();
  await expect(popup.getByLabel('Link concert')).toHaveValue(target);
  expect(errors).toEqual([]);
});

test('một ghế tương ứng một vé; nhận thay đổi chọn ghế và giữ số lượng người dùng đã lưu', async () => {
  const popup = await context.newPage();
  await configure(popup);
  const seats = fixture('seats').replace('<button', '<div role="group" aria-label="Khu A"><h3>Khu A</h3><button').replace('</main>', '</div></main>');
  await context.route('https://ticket.1zone.vn/booking/**', route => route.fulfill({ contentType: 'text/html', body: seats }));
  const event = await context.newPage();
  await event.goto(target.replace('/events/', '/booking/'));
  await expect(event.locator('.recommendation')).toHaveCount(2);
  await expect(event.locator('.recommendation').first()).toContainText('Ghế cụ thể');
  await event.evaluate(() => document.querySelector('main button')!.setAttribute('aria-checked', 'true'));
  await expect(event.locator('.recommendation')).toHaveCount(1);
  await popup.getByLabel('Số vé', { exact: true }).fill('2');
  await popup.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(popup.getByRole('status')).toContainText('Đã lưu');
  await expect(event.locator('.recommendation')).toHaveCount(0);
  await expect(event.getByText('Bạn muốn nhiều vé;', { exact: false })).toBeVisible();
  await popup.reload();
  await expect(popup.getByLabel('Số vé', { exact: true })).toHaveValue('2');
  expect(errors).toEqual([]);
});

test('nhắc giờ lưu bền; chỉ một alarm, dừng sẽ hủy', async () => {
  const popup = await context.newPage();
  await configure(popup);
  // Use storage in the service worker to simulate a future sale independent of the test date.
  const worker = context.serviceWorkers()[0]!;
  await worker.evaluate(async () => {
    const key = 'ticket-assistant.config.v1';
    const config = (await chrome.storage.local.get(key))[key];
    config.preferences.saleStartAt = new Date(Date.now() + 3600000).toISOString();
    await chrome.storage.local.set({ [key]: config });
  });
  await expect.poll(() => worker.evaluate(async () => (await chrome.alarms.getAll()).filter(a => a.name === 'ticket-assistant.sale').length)).toBe(1);
  await popup.locator('.display-settings > summary').click();
  await popup.getByRole('button', { name: 'Tắt công cụ trên trang vé' }).click();
  await expect.poll(() => worker.evaluate(async () => (await chrome.alarms.getAll()).length)).toBe(0);
});

test('khởi động lại browser giữ cấu hình và khôi phục alarm bị mất', async ({}, info) => {
  const profile = info.outputPath('restart-profile');
  const extensionPath = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  const launch = () => chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let browserContext = await launch();
  try {
    let [worker] = browserContext.serviceWorkers();
    if (!worker) worker = await browserContext.waitForEvent('serviceworker');
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': {
        schemaVersion: 1, enabled: true, panelVisible: true,
        preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/restart-test', saleStartAt: new Date(Date.now() + 3600000).toISOString(), quantity: 2, preferredZoneLabels: [], allowAlternatives: false },
      } });
    });
    const firstWorker = worker;
    await expect.poll(() => firstWorker.evaluate(async () => (await chrome.alarms.getAll()).length)).toBe(1);
    await worker.evaluate(async () => { await chrome.alarms.clearAll(); });
    await browserContext.close();
    browserContext = await launch();
    [worker] = browserContext.serviceWorkers();
    if (!worker) worker = await browserContext.waitForEvent('serviceworker');
    const restartedWorker = worker;
    await expect.poll(() => restartedWorker.evaluate(async () => (await chrome.alarms.getAll()).length)).toBe(1);
    const stored = await worker.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1']);
    expect(stored.preferences.quantity).toBe(2);
    expect(stored.enabled).toBe(true);
  } finally { await browserContext.close(); }
});

async function prepareAuto(quantity = '1', state: 'booking' | 'waiting' | 'challenge' = 'booking') {
  // Existing tests leave open tabs sharing preferences. Close them before changing the test target.
  for (const page of context.pages()) await page.close();
  const popup = await context.newPage(); await configure(popup);
  await popup.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)').fill('2020-01-01T00:00');
  await popup.getByLabel('Số vé', { exact: true }).fill(quantity);
  await popup.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(popup.getByRole('status')).toContainText('Đã lưu');
  const body = state === 'booking' ? fixture('booking') + `<script>(${installBookingDemo.toString()})(document)</script>` : fixture(state);
  await context.route('https://ticket.1zone.vn/booking/e2e-test', route => route.fulfill({ contentType: 'text/html', body }));
  const event = await context.newPage();
  await event.goto(target.replace('/events/', '/booking/'));
  await expect(event.locator('.auto-status')).toBeVisible();
  return { popup, event };
}

async function installBookingOnPage(page: Page) {
  const document = await page.evaluateHandle(() => window.document);
  try { await page.evaluate(installBookingDemo, document); }
  finally { await document.dispose(); }
}

test('camp tự chọn zone, đặt 2 vé và tới checkout; không bấm thanh toán', async () => {
  const { event } = await prepareAuto('2');
  const actions: string[] = [];
  await event.exposeFunction('recordAutoAction', (label: string) => actions.push(label));
  await event.evaluate(() => document.querySelector('main')!.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON') void (window as unknown as { recordAutoAction(label: string): Promise<void> }).recordAutoAction(target.textContent ?? '');
  }));
  const started = Date.now();
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('main form')).toContainText('VIP · 2 vé');
  await expect(event.getByRole('button', { name: 'Xác nhận đơn hàng', exact: true })).toBeVisible();
  await expect.poll(() => actions.length).toBe(2);
  expect(actions).toEqual(['Chọn', 'Tiếp tục']);
  const run = await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  const selectionToCheckoutMs = run.progress.checkoutReachedAt - run.progress.selectionStartedAt;
  writeFileSync('artifacts/auto-timing.json', JSON.stringify({ fixture: true, startToObservedCheckoutMs: Date.now() - started, selectionToCheckoutMs, actions }, null, 2));
  expect(selectionToCheckoutMs).toBeLessThan(5000);
  await event.locator('.panel-tools > summary').click();
  const downloadReady = event.waitForEvent('download');
  await event.getByRole('button', { name: 'Lưu báo cáo', exact: true }).click();
  const download = await downloadReady;
  const report = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(report.version).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
  expect(report.requested.quantity).toBe(2);
  expect(report.run).toMatchObject({ phase: 'CHECKOUT', preferencesMatch: true, selectionToCheckoutMs });
  expect(report.run.chosen.label).toBe('VIP');
  expect(report.page.state).toBe('CHECKOUT');
  await expect(event.locator('.countdown-card')).toHaveCount(0);
  await expect(event.getByText('Đã chọn: VIP', { exact: true })).toBeVisible();
  await expect(event.locator('.footnote')).toHaveCount(0);
  expect(JSON.stringify(report)).not.toContain('preferencesKey');
  expect(actions).toEqual(['Chọn', 'Tiếp tục']); // Download must not click a booking control.
  await event.screenshot({ path: 'artifacts/auto-checkout.png' });
  expect(errors).toEqual([]);
});

test('chuyển camp sang một tab duy nhất trước chọn vé; ẩn panel vẫn chạy đúng tab', async () => {
  const { popup, event } = await prepareAuto('1', 'waiting');
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  const worker = context.serviceWorkers()[0]!;
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']?.progress.phase)).toBe('READY');
  const second = await context.newPage(); await second.goto(target.replace('/events/', '/booking/'));
  await second.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(second.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await expect(event.locator('.auto-status')).not.toHaveAttribute('data-auto-phase', 'READY');
  await popup.locator('.display-settings > summary').click();
  await popup.getByLabel('Hiện bảng camp trên trang vé').uncheck();
  // Install controls and handlers in the same task, as a real framework commit does.
  const markup = fixture('booking').match(/<main[\s\S]*?<\/main>/)![0];
  await second.addScriptTag({ content: `document.querySelector('main').outerHTML = ${JSON.stringify(markup)}; (${installBookingDemo.toString()})(document);` });
  await expect(second.locator('main form')).toContainText('VIP · 1 vé');
  await expect(event.locator('main form')).toHaveCount(0);
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']?.progress.phase)).toBe('CHECKOUT');
  await popup.getByLabel('Hiện bảng camp trên trang vé').check();
});

test('camp dừng ở CAPTCHA; dừng camp hủy phiên và không thao tác khi vào chọn vé sau đó', async () => {
  const { event } = await prepareAuto('1', 'challenge');
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'PAUSED');
  await expect(event.locator('.auto-status')).toContainText('xác minh');
  const worker = context.serviceWorkers()[0]!;
  await worker.evaluate(async () => chrome.storage.session.remove('ticket-assistant.auto.session.v1'));
  await event.reload();
  await event.evaluate(() => { document.querySelector('h1')!.textContent = 'Phòng chờ'; });
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await event.getByRole('button', { name: 'Dừng camp', exact: true }).click();
  await event.evaluate(html => { document.querySelector('main')!.outerHTML = new DOMParser().parseFromString(html, 'text/html').querySelector('main')!.outerHTML; }, fixture('booking'));
  await installBookingOnPage(event);
  await expect(event.locator('main [data-cart]')).toHaveText('Chưa chọn vé.');
  expect(await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'])).toBeUndefined();
});

test('demo tương tác chạy cùng bộ camp và không ghi phiên camp thật', async () => {
  const { popup } = await prepareAuto();
  const demo = await context.newPage(); await demo.goto(`chrome-extension://${extensionId}/demo.html`);
  await demo.getByLabel('Luồng đặt vé', { exact: true }).selectOption('booking');
  const frame = demo.frameLocator('iframe[title="Giao diện concert mô phỏng"]');
  await demo.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await expect(frame.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(frame.locator('main form')).toContainText('VIP · 1 vé');
  await popup.reload(); await expect(popup.getByLabel('Link concert')).toHaveValue(target);
  expect(await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'])).toBeUndefined();
});

test('diễn tập mặc định: 2 vé qua modal, làm lại và thử 1 vé, không gọi mạng đặt vé', async () => {
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(`chrome-extension://${extensionId}/demo.html`);
  const frame = page.frameLocator('iframe');
  await page.getByLabel('Số vé', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await expect(frame.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(frame.locator('main form')).toContainText('HAI QUÝ - EB · 2 vé');
  await expect(page.getByRole('button', { name: 'Chạy thử', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Làm lại', exact: true }).click();
  await expect(frame.locator('main form')).toHaveCount(0);
  await page.getByLabel('Số vé', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await expect(frame.locator('main form')).toContainText('HAI QUÝ - EB · 1 vé');
  expect(requests).toEqual([]);
  await page.screenshot({ path: 'artifacts/rehearsal-checkout.png', fullPage: true });
});

for (const scenario of ['queue', 'challenge'] as const) test(`diễn tập ${scenario}: chờ người dùng, rồi mua đúng 2 vé không gọi mạng`, async () => {
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(`chrome-extension://${extensionId}/demo.html`);
  await page.getByLabel('Số vé', { exact: true }).selectOption('2');
  await page.getByLabel('Tình huống', { exact: true }).selectOption(scenario);
  const frame = page.frameLocator('iframe');
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await expect(frame.locator('.auto-status')).toHaveAttribute('data-auto-phase', scenario === 'queue' ? 'READY' : 'PAUSED');
  await expect(frame.locator('main form')).toHaveCount(0);
  await expect(frame.locator('.status-line')).toContainText(scenario === 'queue' ? 'Đang xếp hàng' : 'Cần xác minh');
  await page.getByRole('button', { name: scenario === 'queue' ? 'Cho vào chọn vé' : 'Đã xác minh · chạy tiếp', exact: true }).click();
  await expect(frame.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(frame.locator('main form')).toContainText('HAI QUÝ - EB · 2 vé');
  expect(requests).toEqual([]);
});

test('một ghế SVG có title: chọn một lần và dừng ở checkout', async () => {
  const { event } = await prepareAuto();
  const body = '<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body><main><h1>Chọn ghế</h1><svg width="200" height="100" role="group" aria-label="Khu A"><g role="button" tabindex="0" aria-pressed="false"><title>A1 · 800.000 ₫</title><rect width="80" height="80" fill="blue"/></g></svg><button disabled data-next>Tiếp tục</button></main></body></html>';
  await context.route(target.replace('/events/', '/booking/'), route => route.fulfill({ contentType: 'text/html', body }));
  await event.reload();
  await event.evaluate(() => {
    const seat = document.querySelector('svg g')!;
    const next = document.querySelector<HTMLButtonElement>('[data-next]')!;
    seat.addEventListener('click', () => { seat.setAttribute('aria-pressed', 'true'); next.disabled = false; });
    next.addEventListener('click', () => { document.querySelector('main')!.innerHTML = '<h1>Thanh toán</h1><form>A1 · 1 vé<button type="button">Xác nhận đơn hàng</button></form>'; });
  });
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('main form')).toContainText('A1 · 1 vé');
  expect(errors).toEqual([]);
});

test('bắt đầu từ popup: chờ giờ, tự vào booking và tiếp tục phiên qua điều hướng', async () => {
  const { popup, event: initial } = await prepareAuto();
  await initial.close();
  const booking = target.replace('/events/', '/booking/');
  await context.route(target, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Event mô phỏng</title></head><body><main><h1>Fan meeting</h1><p>Giới thiệu sự kiện</p><a href="${booking}">Mua vé</a></main></body></html>` }));
  const event = await context.newPage(); await event.goto(target);
  await expect(event.locator('.status-line')).toContainText('Trang sự kiện');
  const worker = context.serviceWorkers()[0]!;
  await worker.evaluate(async () => {
    const key = 'ticket-assistant.config.v1';
    const config = (await chrome.storage.local.get(key))[key];
    config.preferences.saleStartAt = new Date(Date.now() + 5000).toISOString();
    await chrome.storage.local.set({ [key]: config });
  });
  // A change from another window invalidates the open form. Reload the saved configuration.
  await popup.reload();
  await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event).toHaveURL(target);
  await expect(event).toHaveURL(booking, { timeout: 12000 });
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('main form')).toContainText('VIP · 1 vé');
  expect(errors).toEqual([]);
});

test('camp một ghế DOM có nhãn tới checkout', async () => {
  const { event } = await prepareAuto();
  const seats = fixture('seats').replace('<button', '<div role="group" aria-label="Khu A"><button').replace('</main>', '</div><button type="button" data-next disabled>Tiếp tục</button></main>');
  await context.route(target.replace('/events/', '/booking/'), route => route.fulfill({ contentType: 'text/html', body: seats }));
  await event.reload();
  await event.evaluate(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('main div[role="group"] button')];
    const next = document.querySelector<HTMLButtonElement>('[data-next]')!;
    buttons.forEach(button => button.addEventListener('click', () => {
      buttons.forEach(b => b.setAttribute('aria-checked', String(b === button))); next.disabled = false;
    }));
    next.addEventListener('click', () => { document.querySelector('main')!.innerHTML = '<h1>Thanh toán</h1><form><p>A1 · 1 vé</p><button type="button">Xác nhận đơn hàng</button></form>'; });
  });
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('main form')).toContainText('A1 · 1 vé');
  expect(errors).toEqual([]);
});

test('trang vẫn khóa lúc bán: reload đúng một lần rồi tiếp tục cùng phiên', async () => {
  const { popup, event } = await prepareAuto();
  let requests = 0;
  const booking = target.replace('/events/', '/booking/');
  await context.route(booking, route => route.fulfill({ contentType: 'text/html', body: requests++ === 0 ? '<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body><h1>Sắp mở bán</h1><button disabled>Sắp mở bán</button></body></html>' : fixture('booking') + `<script>(${installBookingDemo.toString()})(document)</script>` }));
  await event.goto(booking);
  await context.serviceWorkers()[0]!.evaluate(async () => {
    const key = 'ticket-assistant.config.v1', config = (await chrome.storage.local.get(key))[key];
    config.preferences.saleStartAt = new Date(Date.now() + 1500).toISOString(); config.preferences.refreshAtSale = true;
    await chrome.storage.local.set({ [key]: config });
  });
  await popup.reload(); await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  expect(requests).toBe(2);
  const run = await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  expect(run.progress.releaseReloadedAt).toBeGreaterThan(0);
});

test('đóng popup và worker MV3 bị ngắt: giữ phiên, đến giờ vẫn đặt đúng một lần', async () => {
  test.setTimeout(60000);
  const { popup, event } = await prepareAuto();
  const worker = context.serviceWorkers()[0]!;
  await worker.evaluate(async () => {
    const key = 'ticket-assistant.config.v1', config = (await chrome.storage.local.get(key))[key];
    config.preferences.saleStartAt = new Date(Date.now() + 15000).toISOString();
    delete config.preferences.startMode;
    await chrome.storage.local.set({ [key]: config });
  });
  await popup.reload();
  await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-pending', 'false');
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  const original = await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  await popup.close();
  await event.bringToFront();
  const cdp = await context.newCDPSession(event);
  const versions: { versionId: string; scriptURL: string; runningStatus: string }[] = [];
  cdp.on('ServiceWorker.workerVersionUpdated', event => versions.push(...event.versions));
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => versions.find(v => v.scriptURL === worker.url())?.versionId).toBeTruthy();
  const version = versions.find(v => v.scriptURL === worker.url())!;
  await cdp.send('ServiceWorker.stopWorker', { versionId: version.versionId });
  await expect.poll(() => versions.some(v => v.versionId === version.versionId && v.runningStatus === 'stopped')).toBe(true);
  await cdp.detach();
  try { await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT', { timeout: 20000 }); }
  catch (error) {
    const guide = await context.newPage(); await guide.goto(`chrome-extension://${extensionId}/huong-dan.html`);
    const storage = await guide.evaluate(async () => ({ session: await chrome.storage.session.get('ticket-assistant.auto.session.v1'), config: await chrome.storage.local.get('ticket-assistant.config.v1'), now: Date.now() }));
    writeFileSync('artifacts/worker-restart-failure.json', JSON.stringify({ storage, versions, ui: await event.locator('.auto-status').innerText(), reason: await event.locator('.reason').innerText(), countdown: await event.locator('.countdown-card').innerText(), errors }, null, 2));
    throw error;
  }
  await expect(event.locator('main form')).toContainText('VIP · 1 vé');
  const restarted = context.serviceWorkers().find(w => w.url() === worker.url());
  expect(restarted).toBeDefined();
  const stored = await restarted!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  expect(stored.id).toBe(original.id); expect(stored.progress.phase).toBe('CHECKOUT');
  expect(errors).toEqual([]);
});

test('mở bán trễ: nhiều phản hồi vẫn khóa, tự cập nhật tới khi chọn được vé', async () => {
  const { popup, event } = await prepareAuto();
  let requests = 0;
  const booking = target.replace('/events/', '/booking/');
  await context.route(booking, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: requests++ < 3
    ? '<!doctype html><meta charset="utf-8"><h1>Sắp mở bán</h1><button disabled>Sắp mở bán</button>'
    : fixture('booking') + `<script>(${installBookingDemo.toString()})(document)</script>` }));
  await event.goto(booking);
  await context.serviceWorkers()[0]!.evaluate(async () => {
    const key = 'ticket-assistant.config.v1', config = (await chrome.storage.local.get(key))[key];
    config.preferences.saleStartAt = new Date(Date.now() + 1000).toISOString(); config.preferences.refreshAtSale = true;
    await chrome.storage.local.set({ [key]: config });
  });
  await popup.reload(); await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT', { timeout: 20000 });
  expect(requests).toBe(4);
  const run = await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  expect(run.progress.lastReleaseReloadAt).toBeGreaterThan(run.progress.releaseReloadedAt);
  expect(errors).toEqual([]);
});

test('camp ngay nhưng trang giữ trạng thái cũ: tự cập nhật, không chờ ngày cũ trong tương lai', async () => {
  const { popup, event } = await prepareAuto();
  let requests = 0;
  const booking = target.replace('/events/', '/booking/');
  await context.route(booking, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: requests++ === 0
    ? '<!doctype html><meta charset="utf-8"><h1>Sắp mở bán</h1><button disabled>Sắp mở bán</button>'
    : fixture('booking') + `<script>(${installBookingDemo.toString()})(document)</script>` }));
  await event.goto(booking);
  await context.serviceWorkers()[0]!.evaluate(async () => {
    const key = 'ticket-assistant.config.v1', config = (await chrome.storage.local.get(key))[key];
    config.preferences.startMode = 'IMMEDIATE'; config.preferences.saleStartAt = '2030-01-01T00:00:00Z'; config.preferences.refreshAtSale = true;
    await chrome.storage.local.set({ [key]: config });
  });
  await popup.reload(); await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  expect(requests).toBe(2);
});

test('queue.1zone.vn ngoài miền: giữ phiên qua hàng chờ lâu, quay về booking tự chọn tiếp', async () => {
  const { event } = await prepareAuto();
  const booking = target.replace('/events/', '/booking/');
  const queued = 'https://queue.1zone.vn/?t=' + encodeURIComponent(booking);
  await context.route(target, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><h1>Giới thiệu sự kiện</h1><button data-id="btn-by-ticket" onclick="location.href='${queued}'">Mua vé</button>` }));
  await context.route('https://queue.1zone.vn/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><h1>Bạn đang trong hàng chờ</h1><button onclick="location.href='${booking}'">Cho vào · mô phỏng</button>` }));
  await event.goto(target);
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event).toHaveURL(queued);
  await expect(event.locator('.status-line')).toContainText('Đang xếp hàng');
  const before = await context.serviceWorkers()[0]!.evaluate(async () => {
    const key = 'ticket-assistant.auto.session.v1', run = (await chrome.storage.session.get(key))[key];
    run.progress.actionAt = Date.now() - 60000;
    await chrome.storage.session.set({ [key]: run });
    return { id: run.id, tabId: run.tabId };
  });
  await event.getByRole('button', { name: 'Cho vào · mô phỏng' }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  const after = await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  expect(after.id).toBe(before.id); expect(after.tabId).toBe(before.tabId);
  expect(errors).toEqual([]);
});

test('web mở sớm: CTA chính khả dụng thì tự mua trước giờ hẹn trong chế độ theo web', async () => {
  const { popup, event } = await prepareAuto();
  const booking = target.replace('/events/', '/booking/');
  await context.route(target, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><h1>Giới thiệu sự kiện</h1><button data-id="btn-by-ticket" onclick="location.href='${booking}'">Mua vé</button>` }));
  await event.goto(target);
  const saleAt = Date.now() + 120000;
  await context.serviceWorkers()[0]!.evaluate(async saleAt => {
    const key = 'ticket-assistant.config.v1', config = (await chrome.storage.local.get(key))[key];
    config.preferences.startMode = 'WHEN_AVAILABLE'; config.preferences.saleStartAt = new Date(saleAt).toISOString();
    await chrome.storage.local.set({ [key]: config });
  }, saleAt);
  await popup.reload(); await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  const run = await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  expect(run.progress.checkoutReachedAt).toBeLessThan(saleAt);
});

test('mở tay phòng chờ ở tab mới: bấm camp tại đó chuyển quyền, giữ nguyên hàng chờ', async () => {
  const { popup, event } = await prepareAuto();
  await context.route(target, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><h1>Sắp mở bán</h1><button disabled>Sắp mở bán</button>' }));
  await event.goto(target);
  await context.serviceWorkers()[0]!.evaluate(async () => {
    const key = 'ticket-assistant.config.v1', config = (await chrome.storage.local.get(key))[key];
    config.preferences.startMode = 'WHEN_AVAILABLE'; config.preferences.saleStartAt = new Date(Date.now() + 120000).toISOString(); config.preferences.refreshAtSale = false;
    await chrome.storage.local.set({ [key]: config });
  });
  await popup.reload(); await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  const original = await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  const booking = target.replace('/events/', '/booking/');
  const queueUrl = 'https://queue.1zone.vn/?t=' + encodeURIComponent(booking);
  let queueLoads = 0;
  await context.route('https://queue.1zone.vn/**', route => { queueLoads++; return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><h1>Bạn đang trong hàng chờ</h1><button onclick="location.href='${booking}'">Cho vào · mô phỏng</button>` }); });
  const manual = await context.newPage(); await manual.goto(queueUrl);
  await manual.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(manual.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await expect(manual.locator('.status-line')).toContainText('Đang xếp hàng');
  const moved = await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  expect(moved.id).not.toBe(original.id); expect(moved.tabId).not.toBe(original.tabId);
  expect(queueLoads).toBe(1);
  await manual.getByRole('button', { name: 'Cho vào · mô phỏng' }).click();
  await expect(manual.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('.auto-status')).not.toHaveAttribute('data-auto-phase', 'CHECKOUT');
});

test('không bấm dừng: tự hết phiên khi đang ở phòng chờ', async () => {
  const { popup, event } = await prepareAuto('1', 'waiting');
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await popup.close();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-pending', 'false');
  await context.serviceWorkers()[0]!.evaluate(async () => {
    const key = 'ticket-assistant.auto.session.v1', run = (await chrome.storage.session.get(key))[key];
    run.expiresAt = Date.now() + 1200;
    await chrome.storage.session.set({ [key]: run });
    await chrome.tabs.sendMessage(run.tabId, { type: 'AUTO_UPDATED', run });
  });
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'PAUSED');
  await expect(event.locator('.auto-status')).toContainText('hết thời gian');
  await expect(event.locator('main form')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('bấm mua → queue → được trả về event → mua tiếp tới checkout', async () => {
  const { event } = await prepareAuto();
  const intro = '<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body><main><h1>Giới thiệu sự kiện</h1><button data-id="btn-by-ticket">Mua vé</button></main></body></html>';
  await context.route(target, route => route.fulfill({ contentType: 'text/html', body: intro }));
  await event.goto(target);
  let entryClicks = 0;
  await event.exposeFunction('recordEntry', () => { entryClicks++; });
  await event.evaluate(booking => {
    const main = document.querySelector('main')!;
    type DemoWindow = Window & { recordEntry(): Promise<void>; admit(): void };
    const host = window as unknown as DemoWindow;
    document.querySelector('main button')!.addEventListener('click', () => {
      void host.recordEntry(); main.innerHTML = '<h1>Phòng chờ</h1><p>Bạn đang ở hàng đợi.</p>';
    });
    host.admit = () => {
      main.innerHTML = '<h1>Giới thiệu sự kiện</h1><button data-id="btn-by-ticket">Mua vé</button>';
      main.querySelector('button')!.addEventListener('click', () => { void host.recordEntry(); location.href = booking; });
    };
  }, target.replace('/events/', '/booking/'));
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.status-line')).toContainText('Đang xếp hàng');
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await event.evaluate(() => (window as unknown as { admit(): void }).admit());
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('main form')).toContainText('VIP · 1 vé');
  expect(entryClicks).toBe(2); expect(errors).toEqual([]);
});
