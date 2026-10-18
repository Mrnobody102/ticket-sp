import { test, expect, chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installOnezoneMapDemo } from '../../src/testing/onezone-map-demo';
import { calendar, eventData, flightHtml, ticketData } from '../fixtures/catalog';

test('đo sơ đồ Konva thật mở → modal 2 vé → checkout bằng extension production', async () => {
  const extension = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  const version = JSON.parse(readFileSync(resolve(extension, 'manifest.json'), 'utf8')).version as string;
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const samples: number[] = [], errors: string[] = [];
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const zones = [{ id: 'ga-a', name: 'GA A' }, { id: 'ga-b', name: 'GA B' }];
    await worker.evaluate(async ({ metadata, zones, startsAt, venue, ticket }) => {
      globalThis.fetch = async input => {
        const url = String(input);
        if (url.startsWith('https://ticket.1zone.vn/events/catalog-test')) return new Response(metadata);
        if (url.includes('/get-summary-event/event-test/zones?')) return new Response(JSON.stringify({ errorCode: 0, data: zones.map(z => ({ ...z, eventId: 'event-test', calendarId: 'HN', ticketClassId: 'ga-test' })) }));
        if (url.includes('/get-summary-event/event-test?')) return new Response(JSON.stringify({ errorCode: 0, data: [{ ...ticket, ticketClassId: 'ga-test', name: 'GA', type: 'zone', finalPriceVn: 900000, maxTicketPerUser: 4 }] }));
        throw new Error('Map benchmark forbids external requests');
      };
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true, preferences: {
        platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/catalog-test?calendarId=HN', startMode: 'IMMEDIATE', saleStartAt: '2030-01-01T00:00:00Z',
        quantity: 2, preferredZoneLabels: ['GA'], allowAlternatives: false, catalog: { eventId: 'event-test', performanceId: 'HN', title: 'Demo', venue, startsAt, verifiedAt: Date.now(),
          tickets: [{ id: 'ga-test', name: 'GA', priceVnd: 900000, seatMode: 'AUTO', maxQuantity: 4, zones }] } } } });
    }, { metadata: flightHtml(eventData), zones, startsAt: calendar().startDate, venue: calendar().location, ticket: ticketData });
    const konva = readFileSync('node_modules/konva/konva.min.js', 'utf8');
    await context.route('https://ticket.1zone.vn/**', route => new URL(route.request().url()).pathname === '/fixture-konva.js'
      ? route.fulfill({ contentType: 'application/javascript', body: konva })
      : route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><main><h1 id="gate">Sắp mở bán</h1><div id="seatmap-container-event-test-fixture" style="display:none;width:400px;height:220px"></div><div><p>GA</p><p>đ900.000</p></div><div id="modal-host"></div></main><script src="/fixture-konva.js"></script><script>(${installOnezoneMapDemo.toString()})(document)</script>` }));
    for (let index = 0; index < 13; index++) {
      await worker.evaluate(async () => { await chrome.storage.session.clear(); });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto('https://ticket.1zone.vn/booking/catalog-test?calendarId=HN');
        await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
        await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
        await page.evaluate(() => {
          const host = window as unknown as { mapBench: { released: number; checkout: number } };
          host.mapBench = { released: performance.now(), checkout: 0 };
          new MutationObserver(() => {
            if (!host.mapBench.checkout && document.querySelector('#modal-host form')) host.mapBench.checkout = performance.now();
          }).observe(document.querySelector('#modal-host')!, { childList: true, subtree: true });
          document.querySelector('#gate')!.remove();
          (document.querySelector('[id^="seatmap-container-"]') as HTMLElement).style.display = 'block';
        });
        await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
        await expect(page.locator('main form')).toContainText('GA B · 2 vé');
        await expect(page.locator('main')).toHaveAttribute('data-selections', '1');
        await expect(page.locator('main')).toHaveAttribute('data-advances', '1');
        const elapsed = await page.evaluate(() => { const m = (window as unknown as { mapBench: { released: number; checkout: number } }).mapBench; return m.checkout - m.released; });
        expect(elapsed).toBeGreaterThan(0);
        if (index) samples.push(elapsed);
      } finally { await page.close(); }
    }
    expect(errors).toEqual([]);
    const sorted = [...samples].sort((a, b) => a - b);
    const result = { version, observedAt: new Date().toISOString(), fixture: true, renderer: 'Konva 10.3.0', runs: samples.length,
      mapOpenToCheckoutP50Ms: Math.round(sorted[Math.ceil(sorted.length * .5) - 1]! * 10) / 10,
      mapOpenToCheckoutP95Ms: Math.round(sorted[Math.ceil(sorted.length * .95) - 1]! * 10) / 10, samples, errors,
      limitation: 'Synthetic local map and immediate site responses; excludes real network, queue, CAPTCHA and reservation server.' };
    mkdirSync('artifacts', { recursive: true }); writeFileSync('artifacts/map-benchmark.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, samples: undefined }));
  } finally { await context.close(); }
});
