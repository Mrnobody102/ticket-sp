import { test, expect, chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installOnezoneDemo } from '../../src/testing/onezone-demo';
import { calendar, flightHtml } from '../fixtures/catalog';

test('đo từ mở CTA tới checkout qua extension production, không gọi website thật', async () => {
  const path = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  const version = JSON.parse(readFileSync(resolve(path, 'manifest.json'), 'utf8')).version as string;
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`] });
  const samples: { delayMs: number; releaseToEnterMs: number; releaseToCheckoutMs: number; actions: string[] }[] = [];
  const errors: string[] = [];
  const url = 'https://ticket.1zone.vn/events/bench-camp?calendarId=HN';
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const metadata = flightHtml({ id: 'bench-event', name: 'Diễn tập', pathName: 'bench-camp', address: 'Hà Nội', currencyCode: 'VND', eventCalendar: [{ ...calendar(), eventId: 'bench-event' }] });
    await worker.evaluate(html => {
      globalThis.fetch = async input => {
        const url = String(input);
        if (url.startsWith('https://ticket.1zone.vn/events/bench-camp')) return new Response(html);
        if (url.includes('/get-summary-event/bench-event/zones?')) return new Response(JSON.stringify({ errorCode: 0, data: [1, 2].map(index => ({ id: `bench-zone-${index}`, name: `HAI QUÝ ${index}`, ticketClassId: 'bench-hai', eventId: 'bench-event', calendarId: 'HN' })) }));
        if (url.includes('/get-summary-event/bench-event?')) return new Response(JSON.stringify({ errorCode: 0, data: [{ eventId: 'bench-event', calendarId: 'HN', ticketClassId: 'bench-hai', name: 'HAI QUÝ - EB', zoneName: 'HAI QUÝ 2', ticketType: 'seatmap_zone', finalPriceVn: 2996000, seatType: 'auto', maxTicketPerUser: 2 }] }));
        throw new Error('Benchmark forbids external requests');
      };
    }, metadata);
    let body = '';
    await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html', body }));
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    const fixture = readFileSync('fixtures/onezone-modal.html', 'utf8').replaceAll('HAI QUÝ - EB', 'HAI QUÝ 1');
    for (const delayMs of [0, 100]) {
      // First trial in each scenario is a warmup, then collect 12 independent runs.
      for (let index = 0; index < 13; index++) {
        await worker.evaluate(async () => { await chrome.storage.session.clear(); });
        body = fixture.replace('<div id="ticket-list">', '<h2 id="gate">Sắp mở bán</h2><button data-id="btn-by-ticket" disabled>Sắp mở bán</button><button data-sticky disabled>Sắp mở bán</button><div id="ticket-list" hidden>') + `<script>(${installOnezoneDemo.toString()})(document,{checkoutDelayMs:${delayMs},displayName:'HAI QUÝ 1'})</script>`;
        await page.goto(url);
        const saleAt = Date.now() + 60000;
        await worker.evaluate(async ({ saleAt, url, startsAt }) => {
          await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true, preferences: {
            platform: 'onezone', eventUrl: url, startMode: 'WHEN_AVAILABLE', saleStartAt: new Date(saleAt).toISOString(), quantity: 1, preferredZoneLabels: ['HAI QUÝ - EB'], allowAlternatives: false,
            catalog: { eventId: 'bench-event', performanceId: 'HN', title: 'Diễn tập', venue: 'Cung Thiếu nhi Hà Nội', startsAt, verifiedAt: Date.now(), tickets: [{ id: 'bench-hai', name: 'HAI QUÝ - EB', priceVnd: 2996000, seatMode: 'AUTO', zones: [1, 2].map(index => ({ id: `bench-zone-${index}`, name: `HAI QUÝ ${index}` })) }] },
          } } });
        }, { saleAt, url, startsAt: calendar().startDate });
        await page.evaluate(({ delayMs }) => {
          const host = window as unknown as { metrics: { releaseAt: number; first: number; checkoutAt: number; actions: string[] } };
          host.metrics = { releaseAt: 0, first: 0, checkoutAt: 0, actions: [] };
          new MutationObserver(() => {
            if (!host.metrics.checkoutAt && document.querySelector('#modal-host form')) host.metrics.checkoutAt = performance.now();
          }).observe(document.querySelector('#modal-host')!, { childList: true, subtree: true });
          document.addEventListener('click', event => {
            const button = (event.target as HTMLElement).closest('button');
            if (!button || button.closest('[data-ticket-assistant]')) return;
            host.metrics.actions.push(button.getAttribute('data-id') ?? button.textContent ?? '');
          });
          document.querySelector('[data-id="btn-by-ticket"]')!.addEventListener('click', () => {
            host.metrics.first = performance.now();
            const open = () => { document.querySelector('#gate')!.remove(); document.querySelectorAll('main > button').forEach(e => e.remove()); document.querySelector('#ticket-list')!.removeAttribute('hidden'); };
            if (delayMs) setTimeout(open, delayMs); else open();
          });
          document.addEventListener('camp-benchmark-release', () => {
            host.metrics.releaseAt = performance.now();
            document.querySelector('#gate')!.textContent = 'Giới thiệu sự kiện';
            document.querySelectorAll<HTMLButtonElement>('main > button').forEach(e => { e.disabled = false; e.textContent = 'Mua vé'; });
          }, { once: true });
        }, { delayMs });
        await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
        // Measure an already armed run. Catalog/startup time belongs before sale,
        // not inside the reaction-to-opening measurement on a busy machine.
        await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
        await page.evaluate(() => document.dispatchEvent(new Event('camp-benchmark-release')));
        await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
        const observed = await page.evaluate(() => {
          const m = (window as unknown as { metrics: { releaseAt: number; first: number; checkoutAt: number; actions: string[] } }).metrics;
          return { releaseToEnterMs: m.first - m.releaseAt, releaseToCheckoutMs: m.checkoutAt - m.releaseAt, actions: m.actions };
        });
        expect(observed.releaseToEnterMs).toBeGreaterThanOrEqual(0);
        expect(observed.actions).toEqual(['btn-by-ticket', 'Chọn', 'btn-continue']);
        expect(observed.releaseToEnterMs).toBeLessThan(1000);
        if (index) samples.push({ delayMs, ...observed });
      }
    }
    expect(errors).toEqual([]);
    const percentile = (values: number[], p: number) => Math.round([...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]! * 10) / 10;
    const scenarios = [0, 100].map(delayMs => {
      const data = samples.filter(s => s.delayMs === delayMs);
      return { simulatedResponseDelayPerStepMs: delayMs, runs: data.length, releaseToEnterP50Ms: percentile(data.map(s => s.releaseToEnterMs), .5), releaseToEnterP95Ms: percentile(data.map(s => s.releaseToEnterMs), .95), releaseToCheckoutP50Ms: percentile(data.map(s => s.releaseToCheckoutMs), .5), releaseToCheckoutP95Ms: percentile(data.map(s => s.releaseToCheckoutMs), .95) };
    });
    mkdirSync('artifacts', { recursive: true });
    const result = { version, fixture: true, productionExtension: true, armedBeforeRelease: true, browser: context.browser()?.version(), observedAt: new Date().toISOString(), scenarios, samples, errors, limitation: 'No real 1Zone queue, CAPTCHA, network or reservation. Not a live booking guarantee.' };
    writeFileSync('artifacts/camp-benchmark.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ scenarios, errors }));
  } finally { await context.close(); }
});
