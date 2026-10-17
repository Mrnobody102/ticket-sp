import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Public pages only, no website clicks, credentials, booking calls or transaction submission.
const cases = [
  ['vuong-binh-hcm', 'https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than?calendarId=SEsc9b'],
  ['lavender-event', 'https://ticket.1zone.vn/events/lavender-flower-50-nam-cuoc-doi?calendarId=UlSY5H'],
  ['lavender-booking', 'https://ticket.1zone.vn/booking/lavender-flower-50-nam-cuoc-doi?calendarId=UlSY5H'],
  ['tiec-ngu-hanoi', 'https://ticket.1zone.vn/events/tiec-ngu-cai-tour-dau-tien-cua-thang-ha-noi-12443?calendarId=kBjRtS'],
  ['assigned-tram-yeu', 'https://ticket.1zone.vn/events/tram-yeu-5'],
  ['zone-ngay-em-den', 'https://ticket.1zone.vn/events/ngay-em-den'],
];
const requested = process.argv.slice(2);
if (requested.some(name => !cases.some(([known]) => known === name))) throw new Error('Unknown public case name.');
const output = resolve('artifacts/public-cases');
mkdirSync(output, { recursive: true });
const extensionPath = resolve('.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});
const reports = [];
try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  for (const [name, url] of cases) {
    if (requested.length && !requested.includes(name)) continue;
    const page = await context.newPage();
    const canonical = url.replace('/booking/', '/events/');
    await worker.evaluate(async eventUrl => {
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': {
        schemaVersion: 1, enabled: true, panelVisible: true,
        preferences: { platform: 'onezone', eventUrl, saleStartAt: new Date(Date.now() + 3600000).toISOString(), quantity: 2, preferredZoneLabels: [], allowAlternatives: false },
      } });
    }, canonical);
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => undefined);
      const report = await page.evaluate(() => {
        const visible = e => e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
        const text = e => (e.innerText ?? e.textContent ?? '').replace(/\s+/g, ' ').trim();
        const publicBody = document.body.cloneNode(true);
        publicBody.querySelectorAll('[data-ticket-assistant],script,style').forEach(e => e.remove());
        const prices = [...document.querySelectorAll('body *')].filter(e => !e.closest('[data-ticket-assistant]') && e.childElementCount < 3 && visible(e) && /(?:[₫đ]\s*[\d.,]+|[\d.,]+\s*(?:₫|VND|VNĐ))/.test(text(e)) && text(e).length < 90).slice(0, 20).map(e => ({
          tag: e.tagName, role: e.getAttribute('role'), text: text(e),
          parentTag: e.parentElement?.tagName,
          parentClass: e.parentElement?.className,
          parentText: text(e.parentElement).slice(0, 450),
          parentHtml: e.parentElement?.outerHTML.slice(0, 1800),
        }));
        return {
          title: document.title,
          headings: [...document.querySelectorAll('h1,h2,h3,[role="heading"],[role="alert"]')].filter(visible).map(text).slice(0, 24),
          publicText: text(publicBody).slice(0, 4200),
          links: [...document.querySelectorAll('a[href]')].map(e => ({ text: text(e).slice(0, 80), href: e.getAttribute('href') })).filter(e => /\/booking\/|vuong-binh|lavender-flower|tiec-ngu/.test(e.href ?? '')).slice(0, 20),
          structures: { canvas: document.querySelectorAll('canvas').length, svg: document.querySelectorAll('svg').length, iframes: [...document.querySelectorAll('iframe')].map(e => ({ title: e.title, host: (() => { try { return new URL(e.src).host; } catch { return ''; } })() })) },
          mapImages: [...document.images].filter(e => /seatmap|seat map|so do|sơ đồ/i.test(e.alt)).map(e => ({ alt: e.alt, src: e.currentSrc || e.src })),
          buttons: [...document.querySelectorAll('button,[role="button"]')].filter(e => visible(e) && !e.closest('[data-ticket-assistant]')).map(e => ({ text: text(e).slice(0, 100), role: e.getAttribute('role'), disabled: e.matches(':disabled,[aria-disabled="true"]') })).slice(0, 24),
          prices,
        };
      });
      const result = { name, url, finalUrl: page.url(), status: response?.status(), ...report };
      reports.push(result);
      await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: false });
      writeFileSync(resolve(output, `${name}.json`), JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ name, status: result.status, title: result.title, structures: result.structures, prices: result.prices.map(p => p.text), headings: result.headings.slice(0, 5) }));
    } catch (error) { reports.push({ name, url, error: error.message }); console.log(JSON.stringify({ name, error: error.message })); }
    finally { await page.close(); }
  }
  writeFileSync(resolve(output, requested.length ? 'selected-summary.json' : 'summary.json'), JSON.stringify(reports, null, 2));
} finally { await context.close(); }
