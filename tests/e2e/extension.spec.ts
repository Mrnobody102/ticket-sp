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
  const path = resolve('.output/chrome-mv3');
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
  await page.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)').fill('2026-10-18T12:00');
  await page.getByLabel('Số vé', { exact: true }).fill('1');
  await page.getByLabel('Hạng vé ưu tiên · mỗi dòng một hạng').fill('VIP\nKhu A');
  await page.getByRole('button', { name: 'Lưu & bật theo dõi' }).click();
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
  await popup.getByRole('button', { name: 'Mở concert đã lưu' }).click();
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
  await event.getByRole('button', { name: 'Dừng', exact: true }).click();
  await expect(event.locator('.status-line')).toContainText('Đã dừng');
  await expect(event.locator('.highlight')).toHaveCount(0);
  await event.getByRole('button', { name: 'Ẩn panel' }).click();
  await expect(event.getByRole('complementary')).toBeHidden();
  await expect(popup.getByLabel('Hiển thị panel trên trang vé')).not.toBeChecked();
  await popup.getByLabel('Hiển thị panel trên trang vé').check();
  await expect(event.getByRole('complementary')).toBeVisible();
  expect(bookingRequests).toBe(0);
});

test('demo chuyển đủ trạng thái; không ghi đè concert thật', async () => {
  const popup = await context.newPage();
  await configure(popup);
  const demo = await context.newPage();
  await demo.goto(`chrome-extension://${extensionId}/demo.html`);
  const frame = demo.frameLocator('iframe[title="Giao diện concert mô phỏng"]');
  await expect(frame.locator('.recommendation')).toHaveCount(2);
  await demo.screenshot({ path: 'artifacts/demo.png', fullPage: true });
  for (const [label, state] of [['Ghế tự cấp', 'Đang chọn vé'], ['Chọn ghế', 'Đang chọn vé'], ['Phòng chờ', 'Đang xếp hàng'], ['Xác minh', 'Cần xác minh'], ['Thanh toán', 'Thanh toán'], ['Canvas', 'Chưa nhận diện']] as const) {
    await demo.getByRole('button', { name: label, exact: true }).click();
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
  await popup.getByRole('button', { name: 'Lưu & bật theo dõi' }).click();
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
  await popup.getByRole('button', { name: 'Dừng theo dõi' }).click();
  await expect.poll(() => worker.evaluate(async () => (await chrome.alarms.getAll()).length)).toBe(0);
});

test('khởi động lại browser giữ cấu hình và khôi phục alarm bị mất', async ({}, info) => {
  const profile = info.outputPath('restart-profile');
  const extensionPath = resolve('.output/chrome-mv3');
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
  await popup.getByRole('button', { name: 'Lưu & bật theo dõi' }).click();
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
  await expect(event.locator('.auto-status')).toContainText('CHECKOUT');
  await expect(event.locator('main form')).toContainText('VIP · 2 vé');
  await expect(event.getByRole('button', { name: 'Xác nhận đơn hàng', exact: true })).toBeVisible();
  await expect.poll(() => actions.length).toBe(2);
  expect(actions).toEqual(['Chọn', 'Tiếp tục']);
  const run = await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  const selectionToCheckoutMs = run.progress.checkoutReachedAt - run.progress.selectionStartedAt;
  writeFileSync('artifacts/auto-timing.json', JSON.stringify({ fixture: true, startToObservedCheckoutMs: Date.now() - started, selectionToCheckoutMs, actions }, null, 2));
  expect(selectionToCheckoutMs).toBeLessThan(5000);
  await event.screenshot({ path: 'artifacts/auto-checkout.png' });
  expect(errors).toEqual([]);
});

test('camp khóa một tab; phòng chờ tự đi tiếp khi được vào; ẩn panel vẫn chạy', async () => {
  const { popup, event } = await prepareAuto('1', 'waiting');
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  const worker = context.serviceWorkers()[0]!;
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']?.progress.phase)).toBe('READY');
  const second = await context.newPage(); await second.goto(target.replace('/events/', '/booking/'));
  await second.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(second.getByRole('alert')).toContainText('Đang camp trên một tab');
  await popup.getByLabel('Hiển thị panel trên trang vé').uncheck();
  await event.evaluate(html => { document.querySelector('main')!.outerHTML = new DOMParser().parseFromString(html, 'text/html').querySelector('main')!.outerHTML; }, fixture('booking'));
  await installBookingOnPage(event);
  await expect(event.locator('main form')).toContainText('VIP · 1 vé');
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']?.progress.phase)).toBe('CHECKOUT');
  await popup.getByLabel('Hiển thị panel trên trang vé').check();
});

test('camp dừng ở CAPTCHA; dừng camp hủy phiên và không thao tác khi vào chọn vé sau đó', async () => {
  const { event } = await prepareAuto('1', 'challenge');
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toContainText('PAUSED');
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
  await demo.getByRole('button', { name: 'Camp tự động tới checkout', exact: true }).click();
  const frame = demo.frameLocator('iframe[title="Giao diện concert mô phỏng"]');
  await frame.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(frame.locator('.auto-status')).toContainText('CHECKOUT');
  await expect(frame.locator('main form')).toContainText('VIP · 1 vé');
  await popup.reload(); await expect(popup.getByLabel('Link concert')).toHaveValue(target);
  expect(await context.serviceWorkers()[0]!.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'])).toBeUndefined();
});

test('bắt đầu từ popup: chờ giờ, tự vào booking và tiếp tục phiên qua điều hướng', async () => {
  const { popup, event: initial } = await prepareAuto();
  await initial.close();
  const booking = target.replace('/events/', '/booking/');
  await context.route(target, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Event mô phỏng</title></head><body><main><h1>Fan meeting</h1><p>Giới thiệu sự kiện</p><a href="${booking}">Mua vé</a></main></body></html>` }));
  const event = await context.newPage(); await event.goto(target);
  await expect(event.locator('.status-line')).toContainText('Trang concert');
  const worker = context.serviceWorkers()[0]!;
  await worker.evaluate(async () => {
    const key = 'ticket-assistant.config.v1';
    const config = (await chrome.storage.local.get(key))[key];
    config.preferences.saleStartAt = new Date(Date.now() + 5000).toISOString();
    await chrome.storage.local.set({ [key]: config });
  });
  await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event).toHaveURL(target);
  await expect(event).toHaveURL(booking, { timeout: 12000 });
  await expect(event.locator('.auto-status')).toContainText('CHECKOUT');
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
  await expect(event.locator('.auto-status')).toContainText('CHECKOUT');
  await expect(event.locator('main form')).toContainText('A1 · 1 vé');
  expect(errors).toEqual([]);
});
