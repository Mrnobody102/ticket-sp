import { test, expect, chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBookingDemo } from '../../src/testing/booking-demo';

test('đo toàn luồng trang cũ phải F5 → mua → queue → chọn đúng 2 vé → checkout', async () => {
  const extension = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  const version = JSON.parse(readFileSync(resolve(extension, 'manifest.json'), 'utf8')).version;
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const samples: { releaseToQueueMs: number; releaseToCheckoutMs: number; refreshes: number; publicationOffsetMs: number; closedResponsesBeforeRelease: number; selectedLabel: string; quantity: number; holdRequests: number }[] = [], errors: string[] = [];
  const eventUrl = 'https://ticket.1zone.vn/events/entry-benchmark?calendarId=HN', bookingUrl = eventUrl.replace('/events/', '/booking/');
  const queueUrl = 'https://queue.1zone.vn/?t=' + encodeURIComponent(bookingUrl);
  let opened = false, releasedAt = 0, queuedAt = 0, refreshes = 0, closedResponses = 0;
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await worker.evaluate(async url => {
      await chrome.storage.local.set({ 'ticket-assistant.config.v1': { schemaVersion: 1, enabled: true, panelVisible: true,
        preferences: { platform: 'onezone', eventUrl: url, saleStartAt: new Date(Date.now() + 50000).toISOString(), startMode: 'WHEN_AVAILABLE',
          refreshAtSale: true, quantity: 2, preferredZoneLabels: ['VIP'], allowAlternatives: false } } });
    }, eventUrl);
    await context.route(/^https:\/\/(ticket|queue)\.1zone\.vn\//, async route => {
      expect(route.request().method()).toBe('GET');
      const url = new URL(route.request().url());
      const closed = !opened && url.hostname === 'ticket.1zone.vn' && url.pathname.startsWith('/events/');
      let body: string;
      if (url.hostname === 'queue.1zone.vn') {
        queuedAt = Date.now();
        body = `<!doctype html><meta charset="utf-8"><h1>Bạn đang trong hàng chờ</h1><script>setTimeout(()=>location.href=${JSON.stringify(bookingUrl)},200)</script>`;
      } else if (url.pathname.startsWith('/booking/')) {
        body = readFileSync('fixtures/booking.html', 'utf8') + `<script>(${installBookingDemo.toString()})(document);let holds=0;document.querySelector('[data-next]').addEventListener('click',()=>{document.querySelector('main').dataset.checkoutAt=Date.now();document.querySelector('main').dataset.holds=++holds;})</script>`;
      } else {
        refreshes++;
        body = opened
          ? `<!doctype html><meta charset="utf-8"><h1>Giới thiệu sự kiện</h1><button data-id="btn-by-ticket" onclick='location.href=${JSON.stringify(queueUrl)}'>Mua vé</button>`
          : '<!doctype html><meta charset="utf-8"><h1>Sắp mở bán</h1><button disabled>Sắp mở bán</button>';
      }
      // Deliberately include real navigation and an SSR response delay.
      await new Promise(resolve => setTimeout(resolve, 50));
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body });
      if (closed) closedResponses++;
    });
    for (let index = 0; index < 7; index++) {
      opened = false; queuedAt = 0; refreshes = 0; closedResponses = 0;
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(eventUrl);
        await page.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
        await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'READY');
        // Measure an established refresh loop, not the immediate first reload
        // after START. Publish at different offsets across the 1s cadence.
        await expect.poll(() => closedResponses).toBeGreaterThanOrEqual(2);
        const publicationOffsetMs = Math.max(0, index - 1) * 190;
        await new Promise(resolve => setTimeout(resolve, publicationOffsetMs));
        const closedResponsesBeforeRelease = closedResponses;
        releasedAt = Date.now(); opened = true;
        await expect(page.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
        await expect(page.locator('main form')).toContainText('VIP · 2 vé');
        await expect(page.locator('main')).toHaveAttribute('data-holds', '1');
        const checkoutAt = Number(await page.locator('main').getAttribute('data-checkout-at'));
        expect(queuedAt).toBeGreaterThan(releasedAt);
        // Acceptance budget for this controlled 1s refresh + 50ms response fixture.
        expect(queuedAt - releasedAt).toBeLessThan(1500);
        expect(checkoutAt - releasedAt).toBeLessThan(2200);
        const summary = /^(.*?) · (\d+) vé/.exec(await page.locator('main form p').innerText());
        expect(summary).not.toBeNull();
        if (index) samples.push({ releaseToQueueMs: queuedAt - releasedAt, releaseToCheckoutMs: checkoutAt - releasedAt, refreshes, publicationOffsetMs, closedResponsesBeforeRelease,
          selectedLabel: summary![1]!, quantity: Number(summary![2]), holdRequests: Number(await page.locator('main').getAttribute('data-holds')) });
        await expect(page.getByRole('button', { name: 'Xác nhận đơn hàng', exact: true })).toHaveText('Xác nhận đơn hàng');
      } finally { await page.close(); }
    }
    expect(errors).toEqual([]);
    const percentile = (key: 'releaseToQueueMs' | 'releaseToCheckoutMs', p: number) => [...samples].sort((a, b) => a[key] - b[key])[Math.ceil(samples.length * p) - 1]![key];
    const result = { version, fixture: true, armedBeforeRelease: true, warmupRuns: 1, runs: samples.length, successfulRuns: samples.length, queueDelayMs: 200, responseDelayMs: 50,
      releaseToQueueP50Ms: percentile('releaseToQueueMs', .5), releaseToQueueP95Ms: percentile('releaseToQueueMs', .95),
      releaseToCheckoutP50Ms: percentile('releaseToCheckoutMs', .5), releaseToCheckoutP95Ms: percentile('releaseToCheckoutMs', .95), samples, errors,
      limitation: 'Controlled SSR reload and queue fixture; not real inventory, queue admission or reservation server.' };
    mkdirSync('artifacts', { recursive: true }); writeFileSync('artifacts/entry-benchmark.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await context.close(); }
});
