import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = new URL(process.argv[2] ?? 'https://ticket.1zone.vn/events/ngay-em-den');
if (target.protocol !== 'https:' || target.hostname !== 'ticket.1zone.vn' || target.port ||
    target.username || target.password || !/^\/events\/[^/]+\/?$/.test(target.pathname)) {
  throw new Error('Chỉ đọc URL sự kiện công khai trên https://ticket.1zone.vn/events/…');
}
const clean = new URL(target.origin + target.pathname);
if (target.searchParams.has('calendarId')) clean.searchParams.set('calendarId', target.searchParams.get('calendarId'));
const extensionPath = resolve('.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});
try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async url => {
    await chrome.storage.local.set({
      'ticket-assistant.config.v1': {
        schemaVersion: 1, enabled: true, panelVisible: true,
        preferences: {
          platform: 'onezone', eventUrl: url, saleStartAt: new Date(Date.now() + 3600000).toISOString(),
          quantity: 2, preferredZoneLabels: [], allowAlternatives: false,
        },
      },
    });
  }, clean.href);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(clean.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('.status-line').waitFor({ timeout: 15000 });
  // Explicit rescan after hydration; no click on any website control.
  await page.getByRole('button', { name: 'Nhận diện lại' }).click();
  const result = {
    url: clean.href,
    state: await page.locator('.status-line').innerText(),
    reason: await page.locator('.reason').innerText(),
    recommendations: await page.locator('.recommendation').count(),
    panelCount: await page.locator('[data-ticket-assistant]').count(),
    errors,
  };
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/live-smoke.png' });
  writeFileSync('artifacts/live-smoke.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.panelCount !== 1) process.exitCode = 1;
} finally { await context.close(); }
