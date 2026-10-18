import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Only endpoints already observed on the public website. No authentication or mutations.
const output = resolve('artifacts/network-research');
mkdirSync(output, { recursive: true });
const urls = [
  ['onezone-truc-summary', 'https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/fikmaG?type=group&calendarId=3xDSM4'],
  ['onezone-truc-zones', 'https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/fikmaG/zones?calendarId=3xDSM4'],
  ['onezone-truc-seatmap', 'https://prod.1zone.vn/ticketing/api/v4/event/fikmaG/seatmap/3xDSM4'],
  ['onezone-lavender-html', 'https://ticket.1zone.vn/events/lavender-flower-50-nam-cuoc-doi?calendarId=UlSY5H'],
  ['onezone-truc-nhan-html', 'https://ticket.1zone.vn/events/truc-nhan-tan-mui'],
  ['onezone-list-direct', 'https://marketplace.1zone.vn/v2/marketplace/ticket-events?limit=24&page=1'],
  ['onezone-summary-direct', 'https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/14DH0C?type=group&calendarId=SEsc9b'],
  ['onezone-search-direct', 'https://marketplace.1zone.vn/v2/marketplace/search?keyword=V%C6%B0%C6%A1ng%20B%C3%ACnh&limit=10'],
  ['ticketbox-search-direct', 'https://api-v2.ticketbox.vn/search/v3/events?q=V%C6%B0%C6%A1ng%20B%C3%ACnh&filter=upcoming&page=1&limit=8'],
  ['ticketbox-detail-direct', 'https://api-v2.ticketbox.vn/gin/api/v2/events/26657'],
  ['onezone-html-direct', 'https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than?calendarId=SEsc9b'],
  ['onezone-hanoi-html-direct', 'https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2'],
  ['onezone-hanoi-summary-direct', 'https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/aAq6NT?type=group&calendarId=8h0YGm'],
];
function objectAt(text, start) {
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
}
const selected = process.argv.slice(2);
if (selected.some(name => !urls.some(([known]) => known === name))) throw new Error('Unknown catalog case.');
for (const [name, url] of urls.filter(([name]) => !selected.length || selected.includes(name))) {
  try {
    const started = performance.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), credentials: 'omit' });
    const body = await response.text();
    if (name.includes('html') && response.ok) {
      writeFileSync(resolve(output, `${name}.html`), body);
      for (const match of body.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
        try {
          const payload = JSON.parse(match[1]);
          if (typeof payload[1] !== 'string') continue;
          const marker = payload[1].indexOf('"eventData":');
          if (marker < 0) continue;
          const event = objectAt(payload[1], marker + '"eventData":'.length);
          const clean = Object.fromEntries(Object.entries(event).filter(([key]) => /^(id|type|eventType|queueId|name|pathName|eventCalendar|location|address|venue|thumbnail|start|end|opening|status|ticket|seat|booking|max|saleConfig|canPurchase|currencyCode)/i.test(key)));
          writeFileSync(resolve(output, `${name}-event-data.json`), JSON.stringify(clean, null, 2));
          console.log(JSON.stringify({ name, keys: Object.keys(event), data: clean }));
        } catch { /* Not a JSON-bearing flight record. */ }
      }
    } else if (response.ok) {
      const data = JSON.parse(body);
      writeFileSync(resolve(output, `${name}.json`), JSON.stringify(data, null, 2));
      console.log(JSON.stringify({ name, status: response.status, ms: Math.round(performance.now() - started), keys: Object.keys(data), first: data.data?.items?.[0] ?? data.data?.[0] }));
    }
    if (!response.ok) console.log(JSON.stringify({ name, status: response.status, type: response.headers.get('content-type') }));
  } catch (error) { console.log(JSON.stringify({ name, error: error.message })); }
}
