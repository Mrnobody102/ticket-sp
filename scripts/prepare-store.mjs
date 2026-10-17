import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Screenshots from the real production extension, using only local rehearsal.
const extension = resolve(process.argv.find(arg => arg.startsWith('--extension='))?.slice('--extension='.length) ?? '.output/chrome-mv3');
const output = resolve('.output/store-assets');
await mkdir(output, { recursive: true });
const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const page = await context.newPage();
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/demo.html`);
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, '01-dien-tap.png') });
  await page.getByLabel('Số vé', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await page.frameLocator('iframe').locator('.auto-status[data-auto-phase="CHECKOUT"]').waitFor();
  await page.screenshot({ path: resolve(output, '02-ket-qua.png') });
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
  console.log(JSON.stringify({ output, screenshots: 2, width: 1280, height: 800, errors, network }, null, 2));
} finally { await context.close(); }
