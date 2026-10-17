import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read-only inspection on the real event with a disposable, anonymous browser profile.
// Only configure passive observation; never press Start camp or a website purchase control.
const target = 'https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm';
const path = resolve('.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`] });
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const setup = await context.newPage(); await setup.goto(`chrome-extension://${new URL(worker.url()).host}/workspace.html`);
  await setup.getByRole('button', { name: /^Chuẩn bị TIỆC/ }).click();
  const picker = setup.getByLabel('Thêm hạng vé ưu tiên');
  const quote = await picker.locator('option').filter({ hasText: 'HAI QUÝ - EB' }).getAttribute('value');
  if (!quote) throw new Error('Expected target tier not present; inspect catalog instead of guessing.');
  await picker.selectOption(quote);
  await setup.getByRole('button', { name: 'Lưu cấu hình' }).click();
  const page = await context.newPage(); await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('.status-line').waitFor({ timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  const samples = [];
  for (let i = 0; i < 20; i++) {
    samples.push(await page.evaluate(() => {
      const root = document.querySelector('[data-ticket-assistant]')?.shadowRoot;
      const button = [...root?.querySelectorAll('button') ?? []].find(b => b.textContent === 'Nhận diện lại');
      if (!button) throw new Error('Read-only rescan control missing.');
      const started = performance.now(); button.click(); return performance.now() - started;
    }));
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const run = await worker.evaluate(async () => (await chrome.storage.session.get('ticket-assistant.auto.session.v1'))['ticket-assistant.auto.session.v1']);
  if (run) throw new Error('Smoke inspection must never create an automation session.');
  const result = { observedAt: new Date().toISOString(), url: page.url(), state: await page.locator('.status-line').innerText(), reason: await page.locator('.reason').innerText(), domElements: await page.locator('body *').count(), rescanP50Ms: sorted[9], rescanP95Ms: sorted[18], samples, campStarted: false, limitation: 'Read-only public page; no account, queue, purchase, reservation or checkout verification.' };
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/target-readiness.png' });
  writeFileSync('artifacts/target-readiness.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await context.close(); }
