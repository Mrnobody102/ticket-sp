import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Uses the built extension and an isolated browser. Never copies credentials,
// sends a reservation, records personal form values, or replays a request.
const args = process.argv.slice(2), interactive = args.includes('--interactive');
const input = args.find(arg => arg !== '--interactive');
function cleanTarget(input) {
  const target = new URL(input);
  if (target.origin !== 'https://ticketbox.vn' || target.username || target.password ||
      !(/^\/[\w-]+-\d+\/?$/.test(target.pathname) || /^\/events\/\d+\/bookings\/\d+\/select-ticket\/?$/.test(target.pathname))) throw Error('Dùng link sự kiện hoặc chọn vé Ticketbox.');
  target.search = ''; target.hash = ''; return target;
}
let target = input ? cleanTarget(input) : null;
const extension = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: !interactive,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
const network = [], pages = [], pending = new Set();
try {
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    // The caller can inspect selection after signing in. Holding/submitting is blocked.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && /booking|orders?|reserve|hold|cart|payment|seatmap|sections/i.test(url.pathname)) return route.abort();
    return route.continue();
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  // Clear any extension session restored by Chrome's first-run lifecycle.
  await worker.evaluate(async () => chrome.storage.session.clear());
  const setup = await context.newPage();
  await setup.goto(`chrome-extension://${new URL(worker.url()).host}/workspace.html`);
  if (!target) {
    const reply = await setup.evaluate(async () => chrome.runtime.sendMessage({ type: 'CATALOG_SEARCH', platform: 'ticketbox', query: 'ANH TRAI VƯỢT NGÀN CHÔNG GAI 2026 DAY 3 DAY 4', page: 1, fresh: true }));
    if (reply.error) throw Error(reply.error);
    const candidates = (reply.data?.items ?? []).filter(item => {
      const title = item.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return ['anh trai','vuot ngan chong gai','2026','day 3','day 4'].every(part => title.includes(part));
    });
    console.log(JSON.stringify({ candidates: candidates.map(item => ({ id: item.id, title: item.title, url: item.url })), scope: 'Candidates from current Ticketbox discovery, not confirmed sale links.' }));
    if (candidates.length !== 1) throw Error('Chưa xác định được duy nhất một sự kiện. Truyền link Ticketbox đã đối chiếu.');
    target = cleanTarget(candidates[0].url);
  }
  const catalog = await setup.evaluate(async url => chrome.runtime.sendMessage({ type: 'CATALOG_DETAIL', platform: 'ticketbox', url, fresh: true }), target.href);
  await setup.close();
  const page = await context.newPage();
  page.on('response', response => {
    const request = response.request(), url = new URL(response.url());
    if (request.method() !== 'GET' || url.origin !== 'https://api-v2.ticketbox.vn' ||
        !/^\/(?:gin\/api\/v2\/events\/(?:\d+|showings\/\d+)|event\/api\/v1\/events\/(?:\d+\/question-form|showings\/\d+\/(?:seatmap|sections\/\d+)))\/?$/.test(url.pathname)) return;
    const item = { path: url.pathname, http: response.status() }; network.push(item);
    const task = response.json().then(body => {
      item.status = Number.isInteger(body.status) ? body.status : undefined;
      item.code = Number.isInteger(body.code) ? body.code : undefined;
      const value = body.data?.result;
      item.shape = value && typeof value === 'object' ? Object.entries(value).map(([key, child]) => ({ key: key.slice(0, 80), type: Array.isArray(child) ? 'array' : typeof child,
        count: Array.isArray(child) ? child.length : undefined })).slice(0, 80) : [];
    }).catch(() => {}).finally(() => pending.delete(task)); pending.add(task);
  });
  await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (interactive) console.log('Đăng nhập trực tiếp trên cửa sổ test. Có 3 phút xem luồng/chọn vé; giữ vé và thanh toán bị chặn. Đóng cửa sổ để lưu sớm.');
  const deadline = Date.now() + (interactive ? 180000 : 3000);
  let previous;
  while (Date.now() < deadline && !page.isClosed()) {
    const state = await page.evaluate(() => ({
      path: /^\/(?:events\/\d+\/bookings\/\d+\/(?:select-ticket|question-form|payment-info)|(?:queue|waiting-room|presale)\/\d+|[\w-]+-\d+)\/?$/.test(location.pathname) ? location.pathname : '/',
      login: !!document.querySelector('input[type="password"]'),
      challenge: [...document.querySelectorAll('[class*="captcha-module_wrapper__"],iframe')].some(element =>
        element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
        (element.tagName !== 'IFRAME' || /captcha|challenge|turnstile/i.test(element.getAttribute('src') + ' ' + element.getAttribute('title')))),
      canvases: document.querySelectorAll('canvas').length, frames: document.querySelectorAll('iframe').length,
      seatMarkers: document.querySelectorAll('[data-seat-id],[data-zone-id]').length,
      enabledButtons: [...document.querySelectorAll('button')].filter(button => !button.disabled).length,
    })).catch(() => null);
    if (state && JSON.stringify(state) !== previous) { previous = JSON.stringify(state); pages.push({ at: new Date().toISOString(), ...state }); }
    await page.waitForTimeout(1000).catch(() => {});
  }
  await Promise.allSettled([...pending]);
  // Catalog is public metadata. No DOM dump, screenshot, cookies or auth headers.
  const status = catalog.error ? 'CATALOG_ERROR' : catalog.data?.performances?.length ? 'CATALOG_READY_FLOW_UNVERIFIED' : 'CATALOG_NOT_PUBLISHED';
  const report = { at: new Date().toISOString(), status, target: target.href, catalog, pages, network,
    verifiedReservation: false, verifiedCheckout: false, scope: 'Public catalog and read-only browser inspection; reservation/payment blocked.' };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/ticketbox-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ file: 'artifacts/ticketbox-check.json', status, title: catalog.data?.title, showings: catalog.data?.performances?.length, error: catalog.error, pages, reads: network.length, verifiedReservation: false }));
  if (status !== 'CATALOG_READY_FLOW_UNVERIFIED') process.exitCode = 2;
} finally { await context.close(); }
