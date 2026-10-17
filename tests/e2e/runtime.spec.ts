import { test, expect, chromium } from '@playwright/test';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    await expect(page.getByRole('button', { name: 'Lưu & bật theo dõi' })).toBeDisabled();
    await expect(page.locator('textarea')).toHaveCount(0);
    mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/runtime-stale.png' });
    const [expanded] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Mở rộng ↗' }).click()]);
    await expect(expanded).toHaveURL(`chrome-extension://${extensionId}/workspace.html`);
    await expect(expanded.getByRole('alert')).toContainText('Cần tải lại tiện ích');
  } finally { await context.close(); }
});
