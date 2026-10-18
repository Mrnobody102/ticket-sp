import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Reproducible public research: fresh anonymous profile, no order/hold mutations.
const ids = process.argv.slice(2);
if (ids.some(id => !/^[1-9]\d{0,15}$/.test(id))) throw new Error('Pass numeric public event IDs only.');
const directory = resolve('artifacts/ticketbox-research'); mkdirSync(directory, { recursive: true });
const get = async path => {
  const response = await fetch(`https://api-v2.ticketbox.vn${path}`, { method: 'GET', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Public GET failed: ${response.status}`);
  const json = await response.json(); if (json.status !== 1) throw new Error('Invalid public response');
  return json.data?.result;
};
const results = [];
for (const id of ids.length ? ids : ['26657', '26712', '26692', '26681']) {
  const event = await get(`/gin/api/v2/events/${id}`);
  if (String(event?.id) !== id) throw new Error('Event identity mismatch');
  const showing = event.showings?.find(show => Number.isSafeInteger(show.id) && show.id > 0);
  const detail = showing ? await get(`/gin/api/v2/events/showings/${showing.id}`) : null;
  const identities = detail ? [detail.eventId, detail.event?.id].filter(value => value !== undefined && value !== 0) : [];
  if (detail && (!identities.length || identities.some(value => String(value) !== id) || detail.id !== showing.id)) throw new Error('Showing identity mismatch');
  const report = { observedAt: new Date().toISOString(), eventId: id, title: event.title, status: event.status, isBookingAllowed: event.isBookingAllowed,
    requiresAttendeeForm: event.isFormIncluded, showings: event.showings?.length, validShowingId: detail?.id,
    seatMapId: detail?.seatMapId, requiresQueue: detail?.isEnabledQueueWaiting,
    tickets: detail?.ticketTypes?.map(ticket => ({ id: ticket.id, name: ticket.name, priceVnd: ticket.price, min: ticket.minQtyPerOrder, max: ticket.maxQtyPerOrder,
      status: ticket.status, saleStartsAt: ticket.startTime, saleEndsAt: ticket.endTime })),
    scope: 'Anonymous public GET only. No authenticated reservation or checkout verified.' };
  results.push(report); writeFileSync(resolve(directory, `public-${id}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ eventId: id, status: report.status, showing: report.validShowingId, map: report.seatMapId, tickets: report.tickets?.length ?? 0 }));
}

// Inspect one known official select-ticket route, without credentials or submissions.
const first = results.find(result => result.validShowingId);
if (first) {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  try {
    const context = await browser.newContext();
    const blocked = [], network = [], errors = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET' && /\/bookings\/|\/orders(?:\/|$)|\/reserve|\/hold/.test(url.pathname)) {
        blocked.push(url.origin + url.pathname); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message.slice(0, 300)));
    page.on('response', response => {
      const request = response.request();
      if (!['xhr', 'fetch'].includes(request.resourceType())) return;
      const url = new URL(response.url()); network.push({ path: url.origin + url.pathname, method: request.method(), status: response.status() });
    });
    await page.goto(`https://ticketbox.vn/events/${first.eventId}/bookings/${first.validShowingId}/select-ticket`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => (document.body?.innerText.length ?? 0) > 100, undefined, { timeout: 12000 }).catch(() => undefined);
    const dom = await page.evaluate(() => ({ path: location.origin + location.pathname, title: document.title,
      headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent?.trim()).slice(0, 20),
      buttons: [...document.querySelectorAll('button')].map(e => ({ text: e.textContent?.trim().slice(0, 80), disabled: e.disabled, id: e.id })).slice(0, 30),
      textLength: document.body?.innerText.length ?? 0,
      passwordFields: document.querySelectorAll('input[type="password"]').length }));
    writeFileSync(resolve(directory, 'booking-dom.json'), JSON.stringify({ ...dom, network, blocked, errors, authenticated: false }, null, 2));
    await page.screenshot({ path: resolve(directory, 'booking-dom.png') });
    console.log(JSON.stringify({ booking: dom.path, textLength: dom.textLength, passwordFields: dom.passwordFields, blocked: blocked.length, errors: errors.length }));
  } finally { await browser.close(); }
}
