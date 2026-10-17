import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Public, anonymous navigation. No website clicks, credentials or booking mutations.
const target = 'https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm';
const browser = await chromium.launch({ channel: 'chromium', headless: true });
mkdirSync('artifacts/target-research', { recursive: true });
try {
  for (const [name, url] of [['event', target], ['booking', target.replace('/events/', '/booking/')]]) {
    const context = await browser.newContext(); const page = await context.newPage();
    const assets = new Map();
    const pending = [];
    page.on('response', response => {
      if (response.url().startsWith('https://ticket.1zone.vn/_next/static/chunks/') && response.url().endsWith('.js')) {
        pending.push(response.text().then(code => assets.set(response.url(), code)).catch(() => undefined));
      }
    });
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => undefined);
      await Promise.allSettled(pending);
      const dom = await page.evaluate(() => ({
        title: document.title,
        headings: [...document.querySelectorAll('h1,h2,h3')].filter(e => e.getClientRects().length).map(e => e.innerText).slice(0, 20),
        controls: [...document.querySelectorAll('button,a[href],input')].filter(e => e.getClientRects().length).map(e => ({ tag: e.tagName, text: e.innerText?.trim().slice(0, 100), label: e.getAttribute('aria-label'), href: e.getAttribute('href'), disabled: e.matches(':disabled'), html: e.outerHTML.slice(0, 1200) })).filter(e => /vé|mua|bán|buy|ticket|chọn|quantity/i.test(e.text ?? e.label ?? '')).slice(0, 30),
        scripts: [...document.scripts].map(s => s.src).filter(Boolean),
      }));
      const relevant = [];
      for (const [src, code] of assets) {
        const markers = [...new Set(code.match(/(?:ticketClassId|seatType|saleConfig|openSale|bookingType|guestCheckoutEnabled|add-to-cart|buyTicket|buyNow|isSoldOut|data-testid|aria-valuenow)/g) ?? [])];
        if (!markers.length) continue;
        const labels = [...new Set(code.match(/(?:["'])(?:Mua vé[^"']{0,40}|Chọn[^"']{0,50}|Số lượng[^"']{0,40}|Tiếp tục[^"']{0,40}|Hết vé|Đã hết vé|Chưa mở bán)(?:["'])/g) ?? [])];
        relevant.push({ src, bytes: code.length, markers, labels });
        // Source excerpts only from JSX render calls around UI labels. Do not log auth modules.
        for (const label of labels) {
          const index = code.indexOf(label), snippet = code.slice(Math.max(0, index - 500), index + label.length + 500);
          if (!/secret|signature|authorization|Bearer|api.?key|password/i.test(snippet)) relevant.at(-1).ui ??= snippet;
        }
      }
      const result = { observedAt: new Date().toISOString(), requested: url, url: page.url(), status: response?.status(), ...dom, assets: relevant };
      writeFileSync(`artifacts/target-research/${name}.json`, JSON.stringify(result, null, 2));
      await page.screenshot({ path: `artifacts/target-research/${name}.png` });
      console.log(JSON.stringify({ name, url: result.url, status: result.status, headings: result.headings.slice(0, 6), controls: result.controls.map(c => ({ text: c.text, disabled: c.disabled, href: c.href })), assets: relevant }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
