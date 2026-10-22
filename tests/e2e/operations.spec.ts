import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBookingDemo } from '../../src/testing/booking-demo';

const target = 'https://ticket.1zone.vn/events/operations?calendarId=HN';
const booking = target.replace('/events/', '/booking/');
const autoKey = 'ticket-assistant.auto.session.v1', guardKey = 'ticket-assistant.camp-guard.v1', alarm = 'ticket-assistant.camp-guard';
let context: BrowserContext, worker: Worker;
const errors: string[] = [];
test.beforeEach(async () => {
  errors.length = 0;
  const path = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`] });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(async url => {
    await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
      preferences: { platform: 'onezone', eventUrl: url, saleStartAt: new Date(Date.now() + 300000).toISOString(),
        quantity: 1, preferredZoneLabels: ['VIP'], allowAlternatives: false } } });
  }, target);
});
test.afterEach(async () => { await context.close(); expect(errors).toEqual([]); });

for (const stale of [false, true]) test(`ảnh còn treo: ${stale ? 'tự tải mới trạng thái cũ' : 'khởi tạo sớm'} rồi mua tới checkout trước window.load`, async () => {
  const path = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  const manifest = JSON.parse(readFileSync(resolve(path, 'manifest.json'), 'utf8'));
  expect(manifest.content_scripts.find((s: { js: string[] }) => s.js.includes('content-scripts/tickets.js')).run_at).toBe('document_end');
  let imagePending = false, opened = false;
  await context.route('https://ticket.1zone.vn/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/slow-image.png') { imagePending = true; return; }
    const body = url.pathname.startsWith('/booking/')
      ? readFileSync('fixtures/booking.html', 'utf8') + `<script>(${installBookingDemo.toString()})(document)</script>`
      : stale && !opened ? '<!doctype html><meta charset="utf-8"><h1>Sắp mở bán</h1><img src="/slow-image.png"><button disabled>Sắp mở bán</button>'
        : `<!doctype html><meta charset="utf-8"><h1>Giới thiệu sự kiện</h1><img src="/slow-image.png"><a href="${booking}">Mua vé</a>`;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  });
  await worker.evaluate(async () => {
    const key = 'ticket-assistant.config.v1', config = (await chrome.storage.local.get(key))[key];
    config.preferences.startMode = 'IMMEDIATE'; config.preferences.refreshAtSale = true; await chrome.storage.local.set({ [key]: config });
  });
  const page = await context.newPage(); await page.goto(target, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.status-line')).toContainText(stale ? 'Chưa mở bán' : 'Trang sự kiện');
  expect(imagePending).toBe(true); expect(await page.evaluate(() => document.readyState)).toBe('interactive');
  opened = true;
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(page.locator('main form')).toContainText('VIP · 1 vé');
  await expect(page.getByRole('button', { name: 'Xác nhận đơn hàng', exact: true })).toHaveText('Xác nhận đơn hàng');
});

async function armedClosedEvent() {
  let requests = 0;
  await context.route('https://ticket.1zone.vn/**', route => {
    requests++;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><h1>Sắp mở bán</h1><button disabled>Sắp mở bán</button>' });
  });
  const page = await context.newPage(); await page.goto(target);
  await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  await expect.poll(() => worker.evaluate(async key => (await chrome.storage.session.get(key))[key]?.tabId, guardKey)).toBeDefined();
  const run = await worker.evaluate(async key => (await chrome.storage.session.get(key))[key], autoKey);
  return { page, run, requests: () => requests };
}

test('app giữ tab khỏi discard, khôi phục đúng chủ nếu Chrome bỏ tab, Dừng trả lại chính sách', async () => {
  const { run } = await armedClosedEvent();
  await expect.poll(() => worker.evaluate(async id => (await chrome.tabs.get(id)).autoDiscardable, run.tabId)).toBe(false);
  expect(await worker.evaluate(async name => (await chrome.alarms.get(name))?.periodInMinutes, alarm)).toBe(0.5);
  const other = await context.newPage(); await other.goto('about:blank');
  await worker.evaluate(async id => {
    const active = await chrome.tabs.query({ active: true });
    if (active.some(tab => tab.id === id)) throw new Error('Fixture needs an inactive owner tab');
    await chrome.tabs.discard(id);
  }, run.tabId);
  await expect.poll(() => worker.evaluate(async key => (await chrome.storage.session.get(key))[key].tabId, autoKey)).not.toBe(run.tabId);
  const ownerId = await worker.evaluate(async key => (await chrome.storage.session.get(key))[key].tabId, autoKey);
  await expect.poll(() => worker.evaluate(async id => (await chrome.tabs.get(id)).discarded, ownerId)).toBe(false);
  await expect.poll(() => context.pages().some(page => page.url() === target && !page.isClosed())).toBe(true);
  const page = context.pages().find(page => page.url() === target && !page.isClosed())!;
  await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
  expect(await worker.evaluate(async key => (await chrome.storage.session.get(key))[key].id, autoKey)).toBe(run.id);
  await page.getByRole('button', { name: 'Dừng camp', exact: true }).click();
  await expect.poll(() => worker.evaluate(async id => (await chrome.tabs.get(id)).autoDiscardable, ownerId)).toBe(true);
  await expect.poll(() => worker.evaluate(async key => (await chrome.storage.session.get(key))[key], guardKey)).toBeUndefined();
  expect(await worker.evaluate(async name => await chrome.alarms.get(name), alarm)).toBeUndefined();
});

test('alarm chuẩn bị đưa tab camp ra trước một lần, không F5 và không giành focus liên tục', async () => {
  const { run, requests } = await armedClosedEvent();
  const other = await context.newPage(); await other.goto('about:blank');
  await worker.evaluate(async ({ key, name }) => {
    const nativeNow = Date.now;
    const config = (await chrome.storage.local.get(key))[key];
    const host = globalThis as unknown as { nativeNow: typeof Date.now; guardPings: number };
    host.nativeNow = nativeNow; host.guardPings = 0;
    const original = chrome.tabs.sendMessage.bind(chrome.tabs);
    chrome.tabs.sendMessage = ((...args: Parameters<typeof original>) => {
      if ((args[1] as { type?: string } | undefined)?.type === 'AUTO_UPDATED') host.guardPings++;
      return original(...args);
    }) as typeof original;
    await chrome.alarms.create(name, { when: nativeNow() + 100 });
    Date.now = () => Date.parse(config.preferences.saleStartAt) - 120000 + 1;
  }, { key: 'ticket-assistant.config.v1', name: alarm });
  await expect.poll(() => worker.evaluate(async id => (await chrome.tabs.get(id)).active, run.tabId)).toBe(true);
  const count = await worker.evaluate(() => (globalThis as unknown as { guardPings: number }).guardPings);
  await other.bringToFront();
  await worker.evaluate(async name => {
    const host = globalThis as unknown as { nativeNow: typeof Date.now };
    await chrome.alarms.create(name, { when: host.nativeNow() + 100 });
  }, alarm);
  await expect.poll(() => worker.evaluate(() => (globalThis as unknown as { guardPings: number }).guardPings)).toBeGreaterThan(count);
  expect(await worker.evaluate(async id => (await chrome.tabs.get(id)).active, run.tabId)).toBe(false);
  expect(requests()).toBe(1);
  await worker.evaluate(() => { Date.now = (globalThis as unknown as { nativeNow: typeof Date.now }).nativeNow; });
});
