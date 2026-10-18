import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Real public reads through the production extension. Never save config or start camp.
const extensionPath = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(() => {
    const original = globalThis.fetch;
    globalThis.catalogReads = [];
    globalThis.fetch = async (input, options) => {
      if (options?.method !== 'GET' || options?.credentials !== 'omit') throw new Error('Catalog smoke permits anonymous GET only.');
      globalThis.catalogReads.push({ url: String(input), method: options.method });
      return original(input, options);
    };
  });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 460, height: 600 });
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
  await page.getByLabel('Tìm concert', { exact: true }).fill('Vương Bình');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.locator('.event-result').filter({ hasText: /MÂM 2/i }).click({ timeout: 20000 });
  await page.getByLabel('Thêm hạng vé ưu tiên').waitFor({ timeout: 20000 });
  const onezone = {
    url: await page.getByLabel('Link concert').inputValue(),
    title: await page.locator('.selected-event strong').innerText(),
    venue: await page.locator('.selected-event > span').innerText(),
    performance: await page.getByLabel('Suất diễn', { exact: true }).locator('option:checked').innerText(),
    tickets: await page.getByLabel('Thêm hạng vé ưu tiên').locator('option[value]:not([value=""])').evaluateAll(items => items.map(item => ({ id: item.value, label: item.textContent }))),
  };
  // Exercise the actual select and draft priority list; this never saves or buys.
  const targetTier = onezone.tickets.find(ticket => ticket.label?.includes('HAI QUÝ - EB'));
  if (!targetTier) throw new Error('Expected Hanoi tier missing; inspect the catalog before using the preset.');
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption(targetTier.id);
  onezone.draftPriority = await page.locator('.ticket-priorities li').first().innerText();
  onezone.quantityMax = await page.getByLabel('Số vé', { exact: true }).getAttribute('max');
  if (!onezone.draftPriority.includes('2 khu')) throw new Error('HAI QUÝ must include both verified physical zones.');
  const ut = onezone.tickets.find(ticket => ticket.label?.includes('ÚT CƯNG - EB'));
  if (!ut) throw new Error('Expected ÚT CƯNG tier missing.');
  await page.getByRole('button', { name: 'Bỏ HAI QUÝ - EB', exact: true }).click();
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption(ut.id);
  onezone.utPriority = await page.locator('.ticket-priorities li').first().innerText();
  if (!onezone.utPriority.includes('6 khu')) throw new Error('ÚT CƯNG must include all six verified physical zones.');
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/catalog-live-onezone.png', fullPage: true });
  await page.getByRole('button', { name: 'Đổi sự kiện' }).click();
  await page.getByLabel('Nguồn sự kiện').selectOption('ticketbox');
  await page.getByLabel('Tìm concert', { exact: true }).fill('Mắt Nhắm Mắt Mở');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.locator('.event-result').filter({ hasText: /DAY 3/i }).click({ timeout: 20000 });
  // Some events have multiple showings; never assume which performance to preview.
  const showing = page.getByLabel('Suất diễn', { exact: true });
  try { await showing.waitFor({ timeout: 20000 }); }
  catch (error) { console.log(JSON.stringify({ source: 'ticketbox', alert: await page.getByRole('alert').allInnerTexts(), heading: await page.locator('.event-finder').innerText() })); throw error; }
  if (!(await showing.inputValue())) {
    const first = await showing.locator('option[value]:not([value=""])').first().getAttribute('value');
    if (first) await showing.selectOption(first);
  }
  try { await page.locator('.ticket-preview li').first().waitFor({ timeout: 20000 }); }
  catch (error) { console.log(JSON.stringify({ source: 'ticketbox', alert: await page.getByRole('alert').allInnerTexts(), detail: await page.locator('.event-detail').innerText() })); throw error; }
  const ticketbox = { title: await page.locator('.event-detail h3').innerText(), tickets: await page.locator('.ticket-preview li').allInnerTexts() };
  await page.screenshot({ path: 'artifacts/catalog-live-ticketbox.png', fullPage: true });
  const state = await worker.evaluate(async () => ({
    reads: globalThis.catalogReads,
    local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null),
  }));
  const result = { observedAt: new Date().toISOString(), onezone, ticketbox, reads: state.reads, configSaved: !!state.local['ticket-assistant.config.v1'], campStarted: !!state.session['ticket-assistant.auto.session.v1'], errors };
  writeFileSync('artifacts/catalog-live.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.configSaved || result.campStarted || !onezone.url.includes('calendarId=8h0YGm')) process.exitCode = 1;
} finally { await context.close(); }
