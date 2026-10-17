import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  await page.getByLabel('Link concert 1Zone').fill(target);
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
  await expect(popup.getByLabel('Link concert 1Zone')).toHaveValue(target);
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
  await expect(popup.getByLabel('Hiển thị panel trên 1Zone')).not.toBeChecked();
  await popup.getByLabel('Hiển thị panel trên 1Zone').check();
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
  await expect(popup.getByLabel('Link concert 1Zone')).toHaveValue(target);
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
