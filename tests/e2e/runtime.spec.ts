import { test, expect, chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validatePreferences } from '../../src/core/preferences';
import { preferencesKey } from '../../src/core/automation';
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };

// Node 25's native cpSync on Windows mangles non-ASCII destination paths.
// Playwright derives these paths from Vietnamese test titles; copy bytes instead.
function copyExtension(source: string, destination: string) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name), to = join(destination, entry.name);
    if (entry.isDirectory()) copyExtension(from, to);
    else writeFileSync(to, readFileSync(from));
  }
}

async function launch(extensionPath: string, profile = '') {
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  return { context, extensionId: new URL(worker.url()).host };
}

test('cập nhật bản mới: giữ ngày đợt bán mới, hạng/số vé, không tự bật camp', async ({}, info) => {
  const extensionPath = info.outputPath('upgrade-extension');
  const profile = info.outputPath('upgrade-profile');
  copyExtension(resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3'), extensionPath);
  const manifestPath = resolve(extensionPath, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: '0.5.8' }));
  let { context, extensionId } = await launch(extensionPath, profile);
  try {
    const popup = await context.newPage(); await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByLabel('Link concert')).toBeEditable();
    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
        preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm',
          saleStartAt: '2026-10-19T05:00:00.000Z', quantity: 2, preferredZoneLabels: ['ÚT CƯNG - EB'], allowAlternatives: false } } });
    });
    // A real persisted profile and manifest upgrade dispatch onInstalled.
    // Avoid runtime.reload while Playwright is attached to the old worker.
    await context.close();
    writeFileSync(manifestPath, JSON.stringify(manifest));
    ({ context, extensionId } = await launch(extensionPath, profile));
    const restarted = context.serviceWorkers()[0]!;
    await expect.poll(() => restarted.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1'].preferences.saleStartAt)).toBe('2026-10-19T05:00:00.000Z');
    expect(await restarted.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'])).toBeUndefined();
    const updated = await context.newPage(); await updated.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(updated.getByLabel('Giờ mở bán · giờ Việt Nam (UTC+7)')).toHaveValue('2026-10-19T12:00');
    await expect(updated.getByLabel('Số vé', { exact: true })).toHaveValue('2');
    await updated.locator('.extra-settings > summary').click();
    await expect(updated.getByLabel('Hạng vé ưu tiên · mỗi dòng một hạng')).toHaveValue('ÚT CƯNG - EB');
    await expect(updated.getByRole('button', { name: 'Bắt đầu camp', exact: true })).toBeEnabled();
  } finally { await context.close(); }
});

test('Mở rộng mở trang cấu hình bằng link thật, không cần lệnh OPEN_WORKSPACE', async () => {
  const { context, extensionId } = await launch(resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3'));
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
  copyExtension(resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3'), extensionPath);
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
  copyExtension(resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3'), extensionPath);
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

test('đọc phiên lỗi tạm thời: nhận cập nhật hợp lệ rồi tự nối lại phiên cũ, không START hoặc tải lại trang', async ({}, info) => {
  const extensionPath = info.outputPath('bootstrap-recovery-extension');
  const preferences = validatePreferences({ platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/runtime-recovery',
    saleStartAt: '2020-01-01T00:00:00.000Z', startMode: 'IMMEDIATE', quantity: 1, preferredZoneLabels: ['VIP'], allowAlternatives: false });
  copyExtension(resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3'), extensionPath);
  writeFileSync(resolve(extensionPath, 'background.js'), `const fixture = globalThis.__bootstrapFixture = { blocked: true, gets: 0, starts: 0, run: null };
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
      if (message.type === 'RUNTIME_INFO') reply({ info: { version: ${JSON.stringify(version)}, protocolVersion: 1 } });
      else if (message.type === 'AUTO_GET') {
        void chrome.storage.local.get('ticket-assistant.config.v1').then(values => {
          fixture.run ??= { id: 'existing-run', tabId: sender.tab.id, revision: 0, preferencesKey: ${JSON.stringify(preferencesKey(preferences))}, startedAt: Date.now() - 60000, expiresAt: Date.now() + 3600000, progress: { phase: 'READY', message: '' } };
          fixture.gets++; reply(fixture.blocked ? { error: 'Tạm mất kết nối phiên camp.' } : { run: fixture.run });
        }); return true;
      } else if (message.type === 'AUTO_STEP') {
        if (message.id !== fixture.run?.id || message.revision !== fixture.run.revision || sender.tab.id !== fixture.run.tabId) reply({ error: 'Stale fixture step' });
        else { fixture.run = { ...fixture.run, revision: fixture.run.revision + 1, progress: message.progress }; reply({ run: fixture.run }); }
      } else if (message.type === 'AUTO_START' || message.type === 'AUTO_START_HERE') { fixture.starts++; reply({ error: 'Unexpected START' }); }
      else reply({ ok: true });
    });`);
  const { context } = await launch(extensionPath);
  const errors: string[] = [];
  try {
    const worker = context.serviceWorkers()[0]!;
    const target = preferences.eventUrl;
    await worker.evaluate(async preferences => {
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
        preferences } });
    }, preferences);
    let navigations = 0;
    await context.route('https://ticket.1zone.vn/**', route => {
      if (route.request().isNavigationRequest()) navigations++;
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: readFileSync('fixtures/booking.html', 'utf8') + `<script>
        document.querySelector('article button').addEventListener('click', function () { this.setAttribute('aria-pressed', 'true'); document.querySelector('[data-next]').disabled = false; });
        document.querySelector('[data-next]').addEventListener('click', function () { document.querySelector('main').innerHTML = '<h1>Thanh toán</h1><form><p>VIP · 1 vé</p><button>Xác nhận đơn hàng</button></form>'; });
      </script>` });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await page.goto(target.replace('/events/', '/booking/'));
    await expect(page.getByRole('alert')).toContainText('Tạm mất kết nối');
    await expect(page.locator('article button').first()).toHaveAttribute('aria-pressed', 'false');
    await worker.evaluate(async () => {
      const fixture = (globalThis as unknown as { __bootstrapFixture: { blocked: boolean; run: { tabId: number } } }).__bootstrapFixture;
      fixture.blocked = false;
      await chrome.tabs.sendMessage(fixture.run.tabId, { type: 'AUTO_UPDATED', run: fixture.run });
    });
    await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
    await expect(page.locator('main form')).toContainText('VIP · 1 vé');
    expect(await worker.evaluate(() => {
      const fixture = (globalThis as unknown as { __bootstrapFixture: { gets: number; starts: number; run: { id: string } } }).__bootstrapFixture;
      return { gets: fixture.gets, starts: fixture.starts, id: fixture.run.id };
    })).toEqual({ gets: 2, starts: 0, id: 'existing-run' });
    expect(navigations).toBe(1); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('hướng dẫn mở được từ tool và đủ bước cài bản gửi bạn bè', async () => {
  const { context, extensionId } = await launch(resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3'));
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
  copyExtension(resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3'), extensionPath);
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

test('worker mới nhưng tab chỉ có content cũ: không tạo phiên camp giả', async ({}, info) => {
  const extensionPath = info.outputPath('legacy-tab-extension');
  copyExtension(resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3'), extensionPath);
  writeFileSync(resolve(extensionPath, 'content-scripts/tickets.js'), '// Legacy content without readiness handshake.');
  const { context, extensionId } = await launch(extensionPath);
  const errors: string[] = [];
  try {
    const worker = context.serviceWorkers()[0]!;
    const target = 'https://ticket.1zone.vn/events/stale-tab';
    await worker.evaluate(async url => {
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
        preferences: { platform: 'onezone', eventUrl: url, saleStartAt: '2026-10-19T05:00:00Z', quantity: 1, preferredZoneLabels: ['VIP'], allowAlternatives: false } } });
    }, target);
    await context.route(target, route => route.fulfill({ contentType: 'text/html', body: readFileSync('fixtures/zone.html', 'utf8') }));
    const event = await context.newPage(); await event.goto(target);
    const popup = await context.newPage(); popup.on('pageerror', error => errors.push(error.message));
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
    await expect(popup.getByRole('alert')).toContainText('Tải lại tab vé', { timeout: 12000 });
    expect(await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1'])).toBeUndefined();
    await expect(popup.getByRole('button', { name: 'Dừng camp', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
