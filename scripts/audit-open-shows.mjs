import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import { chromium } from '@playwright/test';

// Anonymous inspection of live selling shows. Never arm automation or submit a cart.
const cases = [
  ['lavender', 'lavender-flower-50-nam-cuoc-doi'],
  ['truc-nhan', 'truc-nhan-tan-mui'],
  ['loi-chua-kip-noi', 'loi-chua-kip-noi'],
];
const output = resolve('artifacts/open-shows');
mkdirSync(output, { recursive: true });
const entry = resolve(output, 'audit-entry.ts');
writeFileSync(entry, ['platforms/onezone-catalog', 'platforms/registry'].map(path =>
  `export * from ${JSON.stringify(resolve('src', path).replaceAll('\\', '/'))};`).join('\n'));
const bundled = await build({ configFile: false, logLevel: 'silent',
  build: { write: false, minify: false, lib: { entry, formats: ['iife'], name: 'campAudit' } } });
const script = (Array.isArray(bundled) ? bundled[0] : bundled).output.find(item => item.type === 'chunk').code;
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const reports = [];
try {
  for (const [name, slug] of cases) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const blocked = [], errors = [];
    // Enforced guard even if the site's entry CTA unexpectedly attempts a mutation.
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        blocked.push({ method: request.method(), origin: new URL(request.url()).origin, path: new URL(request.url()).pathname });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    page.on('pageerror', error => errors.push(error.message.slice(0, 300)));
    try {
      await page.goto(`https://ticket.1zone.vn/events/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
      // Use the production catalog parser through anonymous public GETs.
      const { detail, catalog, preferences } = await page.evaluate(async ({ script, slug }) => {
        (0, eval)(script);
        const read = async (url, format) => {
          const reply = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
          if (!reply.ok) throw new Error(`Public GET failed: ${reply.status}`);
          return format === 'json' ? reply.json() : reply.text();
        };
        const provider = globalThis.campAudit.createOnezoneCatalog(read);
        const detail = await provider.detail(`https://ticket.1zone.vn/events/${slug}`);
        const performance = detail.performances[0];
        if (!performance) throw new Error('No performance');
        const catalog = await provider.tickets(detail.id, performance.id);
        const eventUrl = new URL(detail.url); eventUrl.searchParams.set('calendarId', performance.id);
        return { detail, catalog, preferences: { platform: 'onezone', eventUrl: eventUrl.href, saleStartAt: new Date().toISOString(), quantity: 1,
          preferredZoneLabels: catalog.tickets.map(t => t.name), allowAlternatives: false,
          catalog: { eventId: detail.id, performanceId: performance.id, title: detail.title, venue: performance.venue,
            verifiedAt: catalog.fetchedAt, tickets: catalog.tickets } } };
      }, { script, slug });
      await page.goto(preferences.eventUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
      const inspect = () => page.evaluate(({ script, preferences }) => {
        (0, eval)(script);
        const inspection = globalThis.campAudit.inspectPlatform(document, new URL(location.href), { preferences, progress: { phase: 'READY', message: '' } });
        const controls = inspection.automation?.page;
        return { url: location.origin + location.pathname, snapshot: { ...inspection.snapshot, url: location.origin + location.pathname },
          controls: controls && { enterCount: controls.enterCount, advanceCount: controls.advanceCount, selectable: controls.selectable.length,
            quantity: controls.quantity, problem: controls.problem },
          loginVisible: [...document.querySelectorAll('input[type="password"], [role="dialog"]')].some(e => e.getClientRects().length && /dang nhap|đăng nhập|login|sign in/i.test(e.outerHTML)),
          headings: [...document.querySelectorAll('h1,h2,h3,[role="dialog"]')].filter(e => e.getClientRects().length).map(e => e.innerText?.trim().slice(0, 160)).filter(Boolean).slice(0, 10) };
      }, { script, preferences });
      const before = await inspect();
      let entryClicked = false;
      const entry = page.locator('button[data-id="btn-by-ticket"]');
      if (before.controls?.enterCount === 1 && await entry.count() === 1 && await entry.isEnabled()) {
        await entry.click(); entryClicked = true;
        // Wait for a real navigation, login dialog, or booking UI; never click Continue.
        await page.waitForFunction(() => location.hostname !== 'ticket.1zone.vn' || location.pathname.startsWith('/booking/') ||
          [...document.querySelectorAll('[role="dialog"], input[type="password"]')].some(e => e.getClientRects().length), undefined, { timeout: 5000 }).catch(() => undefined);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
      }
      const after = new URL(page.url()).hostname === 'ticket.1zone.vn' ? await inspect() : { url: new URL(page.url()).origin + new URL(page.url()).pathname, authRedirect: true };
      const report = { observedAt: new Date().toISOString(), name, title: detail.title, status: detail.status, eventUrl: preferences.eventUrl,
        tickets: catalog.tickets.map(t => ({ id: t.id, name: t.name, priceVnd: t.priceVnd, seatMode: t.seatMode, maxQuantity: t.maxQuantity, zones: t.zones?.length ?? 0 })),
        before, entryClicked, after, blocked, errors, scope: 'Anonymous entry + read-only inspection; no selection, cart, hold or payment attempted' };
      assert.equal(report.after.snapshot?.state === 'CHECKOUT', false, 'Entry must not be reported as a completed booking test');
      writeFileSync(resolve(output, `${name}.json`), JSON.stringify(report, null, 2));
      await page.screenshot({ path: resolve(output, `${name}.png`) });
      reports.push(report);
      console.log(JSON.stringify({ name, title: report.title, status: report.status, tickets: report.tickets.length,
        before: before.snapshot.state, enterCount: before.controls?.enterCount, entryClicked, after, blocked, errors }));
    } catch (error) {
      reports.push({ name, error: error.message }); console.log(JSON.stringify({ name, error: error.message }));
      process.exitCode = 1;
    } finally { await context.close(); }
  }
  writeFileSync(resolve(output, 'summary.json'), JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
