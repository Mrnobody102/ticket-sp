import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Anonymous, normal page loads only. Never replay mutations, cookies or auth headers.
const cases = [
  ['onezone-home', 'https://ticket.1zone.vn/'],
  ['onezone-search', 'https://ticket.1zone.vn/events'],
  ['onezone-event', 'https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than?calendarId=SEsc9b'],
  ['ticketbox-home', 'https://ticketbox.vn/'],
  ['ticketbox-search', 'https://ticketbox.vn/'],
  ['ticketbox-event', 'https://ticketbox.vn/mat-nham-mat-mo-concert-day-3-26657'],
  ['cticket-home', 'https://cticket.vn/'],
];
const selected = process.argv.slice(2);
if (selected.some(name => !cases.some(([known]) => known === name))) throw new Error('Unknown research case');
const output = resolve('artifacts/network-research');
mkdirSync(output, { recursive: true });
function publicUrl(value) {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) if (/^(?:.*token|auth(?:orization)?|session(?:id)?|code|signature|(?:api|secret|private)[_-]?key)$/i.test(key)) url.searchParams.set(key, '[redacted]');
  return url.href;
}
function shape(value, depth = 0) {
  if (value === null || depth > 3) return value === null ? 'null' : typeof value;
  if (Array.isArray(value)) return { length: value.length, item: value[0] === undefined ? null : shape(value[0], depth + 1) };
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 45).map(([key, child]) => [key, /token|password|secret|authorization|cookie/i.test(key) ? '[redacted]' : shape(child, depth + 1)]));
  return typeof value;
}
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  for (const [name, url] of cases) {
    if (selected.length && !selected.includes(name)) continue;
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const network = [];
    const pending = [];
    page.on('response', response => {
      const request = response.request();
      const type = response.headers()['content-type'] ?? '';
      if (!['xhr', 'fetch'].includes(request.resourceType()) || !/json/i.test(type)) return;
      const record = { url: publicUrl(response.url()), method: request.method(), status: response.status() };
      network.push(record);
      pending.push(response.json().then(data => {
        record.shape = shape(data);
        if (request.method() === 'GET' && /ticket-events|ticket-summary|discovery\/(banners|categories)|event\/(list|search)|search|events\/\d/.test(response.url())) {
          writeFileSync(resolve(output, `${name}-public-${network.indexOf(record)}.json`), JSON.stringify(data, (key, value) => /token|password|secret|authorization|cookie/i.test(key) ? '[redacted]' : value, 2));
        }
      }).catch(() => undefined));
    });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => undefined);
      if (name.endsWith('-search')) {
        if (name === 'onezone-search') await page.getByRole('button', { name: 'Tìm kiếm tên sự kiện', exact: true }).filter({ visible: true }).first().click();
        const search = page.locator('input:not([readonly])').filter({ visible: true }).first();
        await search.fill('Vương Bình'); await search.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => undefined);
      }
      await page.waitForTimeout(1500);
      await Promise.allSettled(pending);
      const dom = await page.evaluate(() => ({
        title: document.title,
        headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent?.trim()).slice(0, 15),
        links: [...document.querySelectorAll('a[href]')].map(e => ({ text: e.textContent?.trim().slice(0, 100), href: e.getAttribute('href') })).filter(e => /event|search|ticket|su-kien/i.test(e.href ?? '')).slice(0, 40),
        scripts: [...document.scripts].map(e => ({ src: e.src || undefined, type: e.type, id: e.id, length: e.textContent?.length })),
        inputs: [...document.querySelectorAll('input')].map(e => ({ type: e.type, placeholder: e.placeholder })),
      }));
      const result = { observedAt: new Date().toISOString(), name, url, finalUrl: publicUrl(page.url()), network, ...dom };
      if (name === 'onezone-event') {
        writeFileSync(resolve(output, `${name}-public.html`), await page.content());
        const snippets = [];
        for (const script of dom.scripts.filter(s => s.src?.startsWith('https://ticket.1zone.vn/_next/'))) {
          const response = await context.request.get(script.src);
          const code = await response.text();
          const paths = [...new Set(code.match(/(?:https:\/\/|\/)(?:[\w.-]+\/)*(?:ticket|calendar|booking|order|event)[\w/?=.&${}-]*/g) ?? [])].filter(path => path.length < 240);
          if (paths.length) snippets.push({ src: script.src, paths: paths.slice(0, 60) });
        }
        writeFileSync(resolve(output, `${name}-asset-paths.json`), JSON.stringify(snippets, null, 2));
      }
      writeFileSync(resolve(output, `${name}.json`), JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ name, title: dom.title, endpoints: network.map(e => ({ url: e.url, method: e.method, status: e.status })), links: dom.links.slice(0, 5) }));
    } catch (error) { console.log(JSON.stringify({ name, error: error.message })); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
