import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Anonymous, read-only public-page inspection. No purchase clicks or camp session.
const target = new URL(process.argv[2] ?? 'https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6');
if (target.origin !== 'https://ticket.1zone.vn' || !/^\/(events|booking)\/[\w-]+$/.test(target.pathname)) throw new Error('Unsupported public event URL');
const directory = process.argv[2] ? 'artifacts/reference-map' : 'artifacts/capitaneus';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame() || !/^https:\/\/(ticket|queue)\.1zone\.vn\//.test(frame.url())) return;
    const u = new URL(frame.url());
    let destination;
    try { const t = new URL(u.searchParams.get('t')); destination = t.origin + t.pathname + '?calendarId=' + encodeURIComponent(t.searchParams.get('calendarId') ?? ''); } catch {}
    console.log(JSON.stringify({ navigation: u.origin + u.pathname, calendarId: u.searchParams.get('calendarId'), queueEvent: u.searchParams.get('e'), destination }));
  });
  const pending = [];
  const inventories = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === 'https://prod.1zone.vn' && /^\/ticketing\/api\/v4\/event\/[\w-]+\/tickets$/.test(url.pathname)) {
      pending.push(response.json().then(async payload => {
        const records = Array.isArray(payload.data) ? payload.data.map(s => Object.fromEntries(['_id','id','eventId','calendarId','ticketClassId','zoneId','zoneName','rowName','code','status'].filter(k => s[k] !== undefined).map(k => [k, s[k]]))) : [];
        inventories.push({ count: records.length, samples: records.slice(0, 4), errorCode: payload.errorCode });
        await writeFile(`${directory}/inventory.json`, JSON.stringify(records, null, 2));
      }).catch(() => {}));
    }
    if (url.hostname === 'ticket.1zone.vn' && url.pathname.startsWith('/_next/static/chunks/') && url.pathname.endsWith('.js')) {
      pending.push(response.body().then(bytes => writeFile(`${directory}/${url.pathname.split('/').at(-1)}`, bytes)).catch(() => {}));
    }
  });
  await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  if (await page.locator('canvas').count()) await page.locator('canvas').first().scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await Promise.allSettled(pending);
  const result = await page.evaluate(async () => ({ title: document.title, headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent), controls: [...document.querySelectorAll('button')].map(e => ({ text: e.innerText, disabled: e.disabled, id: e.getAttribute('data-id') })), maps: [...document.querySelectorAll('canvas')].map(e => e.parentElement?.parentElement?.outerHTML.slice(0, 1500)),
    frames: [...document.querySelectorAll('iframe')].map(e => ({ title: e.title, origin: e.src ? new URL(e.src).origin : '', container: e.parentElement?.parentElement?.id })),
    charts: await Promise.all((window.seatsio?.charts ?? []).map(async chart => ({ state: chart.state, event: chart.config?.event, mode: chart.config?.mode, containerId: chart.config?.container?.id, methods: ['doSelectObjects', 'selectObjects', 'holdBestAvailable', 'findObject', 'listCategories', 'listSelectedObjects'].filter(name => typeof chart[name] === 'function'), categories: await Promise.race([chart.listCategories().then(items => items.map(c => ({ key: c.key, label: c.label, hasSelectableObjects: c.hasSelectableObjects, pricing: c.pricing }))), new Promise(resolve => setTimeout(() => resolve('timeout'), 5000))]).catch(() => 'unavailable') }))),
  }));
  // Keep routing evidence, but never export queue identifiers or admission tokens.
  const final = new URL(page.url());
  result.route = { origin: final.origin, path: final.pathname,
    client: final.searchParams.get('c'), event: final.searchParams.get('e'),
    destination: (() => { try { const u = new URL(final.searchParams.get('t')); return u.origin + u.pathname + (u.searchParams.has('calendarId') ? '?calendarId=' + encodeURIComponent(u.searchParams.get('calendarId')) : ''); } catch { return null; } })() };
  await page.screenshot({ path: `${directory}/public.png`, fullPage: true });
  await writeFile(`${directory}/public.json`, JSON.stringify({ ...result, inventories }, null, 2));
  console.log(JSON.stringify({ ...result, inventories }, null, 2));
} finally { await browser.close(); }
