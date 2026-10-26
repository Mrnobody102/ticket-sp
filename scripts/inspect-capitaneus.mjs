import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Anonymous, read-only public-page inspection. No purchase clicks or camp session.
const directory = 'artifacts/capitaneus';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const pending = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.hostname === 'ticket.1zone.vn' && url.pathname.startsWith('/_next/static/chunks/') && url.pathname.endsWith('.js')) {
      pending.push(response.body().then(bytes => writeFile(`${directory}/${url.pathname.split('/').at(-1)}`, bytes)).catch(() => {}));
    }
  });
  await page.goto('https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.locator('canvas').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1000);
  await Promise.allSettled(pending);
  const result = await page.evaluate(() => ({ title: document.title, headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent), controls: [...document.querySelectorAll('button')].map(e => ({ text: e.innerText, disabled: e.disabled, id: e.getAttribute('data-id') })), maps: [...document.querySelectorAll('canvas')].map(e => e.parentElement?.parentElement?.outerHTML.slice(0, 1500)) }));
  await page.screenshot({ path: `${directory}/public.png`, fullPage: true });
  await writeFile(`${directory}/public.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
