import { test, expect, chromium } from '@playwright/test';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };

async function launch(extensionPath: string) {
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  return { context, extensionId: new URL(worker.url()).host };
}

test('Mở rộng mở trang cấu hình bằng link thật, không cần lệnh OPEN_WORKSPACE', async () => {
  const { context, extensionId } = await launch(resolve('.output/chrome-mv3'));
  try {
    const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByLabel('Link concert')).toBeEditable();
    const [expanded] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Mở rộng ↗' }).click()]);
    await expect(expanded).toHaveURL(`chrome-extension://${extensionId}/workspace.html`);
    await expect(expanded.locator('main.workspace')).toBeVisible();
    await expect(expanded.getByLabel('Link concert')).toBeEditable();
    await expect(expanded.getByRole('alert')).toHaveCount(0);
  } finally { await context.close(); }
});

test('UI mới + worker cũ: báo reload rõ ràng, khóa camp nhưng Mở rộng vẫn hoạt động', async ({}, info) => {
  // Reproduce a mixed installation without touching the actual release or user profile.
  const extensionPath = info.outputPath('legacy-extension');
  cpSync(resolve('.output/chrome-mv3'), extensionPath, { recursive: true });
  writeFileSync(resolve(extensionPath, 'background.js'), `chrome.runtime.onMessage.addListener((_message, _sender, reply) => { reply({ error: 'Lệnh không được hỗ trợ.' }); });`);
  const { context, extensionId } = await launch(extensionPath);
  try {
    const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByRole('alert')).toContainText('chrome://extensions');
    await expect(page.getByRole('alert')).toContainText('Cần tải lại tiện ích');
    await expect(page.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Lưu cấu hình' })).toBeDisabled();
    await expect(page.locator('textarea')).toHaveCount(0);
    mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/runtime-stale.png' });
    const [expanded] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Mở rộng ↗' }).click()]);
    await expect(expanded).toHaveURL(`chrome-extension://${extensionId}/workspace.html`);
    await expect(expanded.getByRole('alert')).toContainText('Cần tải lại tiện ích');
  } finally { await context.close(); }
});

test('content bị worker cũ từ chối: có lỗi trên panel, không Uncaught hoặc tự camp', async ({}, info) => {
  const extensionPath = info.outputPath('legacy-content-extension');
  cpSync(resolve('.output/chrome-mv3'), extensionPath, { recursive: true });
  writeFileSync(resolve(extensionPath, 'background.js'), `chrome.runtime.onMessage.addListener((_message, _sender, reply) => { reply({ error: 'Lệnh chỉ dùng trong trang cấu hình tiện ích.' }); });`);
  const { context } = await launch(extensionPath);
  const errors: string[] = [];
  try {
    await context.serviceWorkers()[0]!.evaluate(async () => {
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
        preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/runtime-test', saleStartAt: '2030-01-01T00:00:00Z', quantity: 1, preferredZoneLabels: ['VIP'], allowAlternatives: false } } });
    });
    await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html', body: readFileSync('fixtures/zone.html', 'utf8') }));
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://ticket.1zone.vn/events/runtime-test');
    await expect(page.getByRole('complementary', { name: 'Trợ lý camp vé' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('chrome://extensions');
    await expect(page.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toHaveCount(0);
    await expect(page.locator('article button').first()).not.toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
    await page.screenshot({ path: 'artifacts/content-startup-error.png' });
  } finally { await context.close(); }
});

test('hướng dẫn mở được từ tool và đủ bước cài bản gửi bạn bè', async () => {
  const { context, extensionId } = await launch(resolve('.output/chrome-mv3'));
  try {
    const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/popup.html`);
    const [guide] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Hướng dẫn', exact: true }).click()]);
    await expect(guide).toHaveURL(`chrome-extension://${extensionId}/huong-dan.html`);
    await expect(guide.getByRole('heading', { name: 'Cài một lần' })).toBeVisible();
    await expect(guide.locator('body')).toContainText('manifest.json');
    await expect(guide.getByRole('heading', { name: 'Chuẩn bị đặt vé' })).toBeVisible();
  } finally { await context.close(); }
});

test('worker từ chối lệnh khi bấm camp: lỗi được bắt, không Uncaught hoặc click vé', async ({}, info) => {
  const extensionPath = info.outputPath('legacy-start-extension');
  cpSync(resolve('.output/chrome-mv3'), extensionPath, { recursive: true });
  writeFileSync(resolve(extensionPath, 'background.js'), `chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message.type === 'RUNTIME_INFO') reply({ info: { version: ${JSON.stringify(version)}, protocolVersion: 1 } });
    else if (message.type === 'AUTO_GET') reply({ run: null });
    else reply({ error: 'Lệnh chỉ dùng trong trang cấu hình tiện ích.' });
  });`);
  const { context } = await launch(extensionPath);
  const errors: string[] = [];
  try {
    await context.serviceWorkers()[0]!.evaluate(async () => {
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
        preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/runtime-start', saleStartAt: '2020-01-01T00:00:00Z', quantity: 1, preferredZoneLabels: ['VIP'], allowAlternatives: false } } });
    });
    await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html', body: readFileSync('fixtures/zone.html', 'utf8') }));
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://ticket.1zone.vn/events/runtime-start');
    await expect(page.locator('.panel-version')).toHaveText(`v${version}`);
    await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('chrome://extensions');
    await expect(page.locator('.auto-status')).not.toHaveAttribute('data-auto-phase');
    await expect(page.locator('article button').first()).not.toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
