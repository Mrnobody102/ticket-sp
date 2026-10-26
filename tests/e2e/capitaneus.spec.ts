import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { capitaneusEvent, capitaneusTypes, capitaneusUrl, capitaneusZones } from '../fixtures/capitaneus';
import { flightHtml } from '../fixtures/catalog';

// Contract fixture: official modal/control markers with public class IDs/prices.
// This does not pretend to be the authenticated Seats.io booking page.
function installBooking(document: Document, ticket: { name: string; ticketClassId: string; finalPriceVn: number }) {
  const main = document.querySelector('main')!;
  const host = document.querySelector('#modal-host')!;
  document.querySelector('#ticket-list button')!.addEventListener('click', () => {
    main.setAttribute('data-choices', String(Number(main.getAttribute('data-choices') ?? 0) + 1));
    host.innerHTML = `<div role="dialog"><h2>Chọn số lượng vé</h2><p>${ticket.name}</p><div><span>${ticket.finalPriceVn.toLocaleString('vi-VN')} ₫</span><div><button data-id="btn-sub" disabled>−</button><span>1</span><button data-id="btn-add">+</button></div></div><iframe title="captcha" srcdoc=""></iframe><button data-solve>Xác minh xong · mô phỏng</button><footer><button data-id="btn-continue" disabled>Tiếp tục</button></footer></div>`;
    const count = host.querySelector('[data-id="btn-add"]')!.previousElementSibling!;
    const plus = host.querySelector<HTMLButtonElement>('[data-id="btn-add"]')!;
    const minus = host.querySelector<HTMLButtonElement>('[data-id="btn-sub"]')!;
    const advance = host.querySelector<HTMLButtonElement>('[data-id="btn-continue"]')!;
    const update = (delta: number) => { count.textContent = String(Number(count.textContent) + delta); plus.disabled = count.textContent === '2'; minus.disabled = count.textContent === '1'; };
    plus.addEventListener('click', () => update(1)); minus.addEventListener('click', () => update(-1));
    host.querySelector('[data-solve]')!.addEventListener('click', () => { advance.disabled = false; });
    advance.addEventListener('click', () => {
      main.setAttribute('data-holds', String(Number(main.getAttribute('data-holds') ?? 0) + 1));
      host.innerHTML = `<h1>Thanh toán</h1><form><p>${ticket.name} · ${count.textContent} vé</p><button type="button">Xác nhận đơn hàng</button></form>`;
    });
  });
}

let context: BrowserContext;
test.afterEach(async () => { await context?.close(); });

async function setup() {
  const extension = resolve(process.env.CAMP_EXTENSION_DIR ?? '.output/chrome-mv3');
  context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(({ html, types, zones }) => {
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.includes('/events/capitaneus-mutabilis-2026')) return new Response(html);
      if (!url.includes('/get-summary-event/kAapup')) throw new Error('Unexpected catalog URL');
      return new Response(JSON.stringify({ errorCode: 0, data: url.includes('/zones?') ? zones : types }));
    };
  }, { html: flightHtml(capitaneusEvent), types: capitaneusTypes, zones: capitaneusZones });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/workspace.html`);
  await page.getByLabel('Tìm concert', { exact: true }).fill(capitaneusUrl);
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await expect(page.getByLabel('Thêm hạng vé ưu tiên')).toBeVisible();
  return { page, worker };
}

for (const tier of capitaneusTypes) for (const quantity of [1, 2]) test(`CAPITANEUS ${tier.name} × ${quantity}: catalog, iframe cạnh thẻ tự cấp, CAPTCHA rồi giữ đúng một lần`, async () => {
  const { page } = await setup();
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption(tier.ticketClassId);
  await expect(page.getByLabel('Số vé', { exact: true })).toHaveAttribute('max', '2');
  await page.getByLabel('Số vé', { exact: true }).fill(String(quantity));
  await page.getByLabel('Cách bắt đầu camp').selectOption('IMMEDIATE');
  await page.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  const booking = capitaneusUrl.replace('/events/', '/booking/');
  await context.route(/^https:\/\/ticket\.1zone\.vn\//, route => {
    const body = new URL(route.request().url()).pathname.startsWith('/booking/')
      ? `<main><h1>Chọn vị trí chỗ ngồi trên sơ đồ</h1><div id="seatio"><iframe title="Sơ đồ" srcdoc=""></iframe></div><div id="ticket-list"><div><p>${tier.name}</p><p>${tier.finalPriceVn.toLocaleString('vi-VN')} ₫</p><button>Chọn</button></div></div><div id="modal-host"></div></main><script>(${installBooking.toString()})(document,${JSON.stringify(tier)})</script>`
      : `<main><h3>Sắp mở bán</h3><button data-id="btn-by-ticket" disabled onclick="location.href='${booking}'">Sắp mở bán</button></main>`;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8">${body}` });
  });
  const event = await context.newPage(); await event.goto(capitaneusUrl);
  await expect(event.locator('.status-line')).toContainText('Chưa mở bán');
  await event.locator('main button').evaluate((button: HTMLButtonElement) => { button.disabled = false; button.textContent = 'Mua vé'; });
  await expect(event.locator('.status-line')).toContainText('Trang sự kiện');
  await event.getByRole('button', { name: 'Bắt đầu camp', exact: true }).click();
  await expect(event.locator('.auto-status')).toContainText('Chờ xác minh');
  await expect(event.locator('main')).not.toHaveAttribute('data-holds');
  await event.getByRole('button', { name: 'Xác minh xong · mô phỏng' }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('main form')).toContainText(`${tier.name} · ${quantity} vé`);
  await expect(event.locator('main')).toHaveAttribute('data-choices', '1');
  await expect(event.locator('main')).toHaveAttribute('data-holds', '1');
  await expect(event.getByRole('button', { name: 'Xác nhận đơn hàng' })).toBeVisible();
});

test('UI: tên dài không đè nút ưu tiên; footer và form dùng được ở cửa sổ hẹp/thấp', async () => {
  const { page } = await setup();
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption(capitaneusTypes[0]!.ticketClassId);
  await page.locator('.priority-copy b').evaluate(element => { element.textContent = 'HẠNG VÉ CÓ TÊN RẤT DÀI '.repeat(8); });
  mkdirSync('artifacts', { recursive: true });
  for (const [width, height] of [[390, 600], [820, 500], [1280, 720]] as const) {
    await page.setViewportSize({ width, height });
    const copy = await page.locator('.priority-copy').boundingBox();
    const actions = await page.locator('.priority-actions').boundingBox();
    expect(copy!.x + copy!.width).toBeLessThanOrEqual(actions!.x);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    if (width <= 800) {
      const finder = await page.locator('.event-finder').boundingBox();
      const form = await page.locator('.setup-form').boundingBox();
      const note = await page.locator('.source-note').boundingBox();
      expect(note!.y + note!.height).toBeLessThanOrEqual(finder!.y + finder!.height);
      expect(finder!.y + finder!.height).toBeLessThan(form!.y);
    }
    await expect(page.getByRole('button', { name: 'Lưu cấu hình', exact: true })).toBeInViewport();
    await page.screenshot({ path: `artifacts/capitaneus-ui-${width}.png` });
  }
});

test('Lưu và camp: một nút lưu đúng bản nháp rồi chạy, bấm hai lần không tạo phiên/đơn trùng', async () => {
  const { page, worker } = await setup();
  const tier = capitaneusTypes[0]!;
  await page.getByLabel('Thêm hạng vé ưu tiên').selectOption(tier.ticketClassId);
  await page.getByLabel('Số vé', { exact: true }).fill('2');
  await page.getByLabel('Cách bắt đầu camp').selectOption('IMMEDIATE');
  await context.route('https://ticket.1zone.vn/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><main><h1>Chọn khu vực</h1><p>Ghế được tự động cấp</p><div id="ticket-list"><div><p>${tier.name}</p><p>${tier.finalPriceVn.toLocaleString('vi-VN')} ₫</p><button>Chọn</button></div></div><div id="modal-host"></div></main><script>(${installBooking.toString()})(document,${JSON.stringify(tier)})</script>` }));
  const opened = context.waitForEvent('page');
  const start = page.getByRole('button', { name: 'Lưu và camp', exact: true });
  await expect(start).toBeEnabled();
  await start.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  const event = await opened;
  await expect(event.locator('.auto-status')).toContainText('Chờ xác minh');
  await event.getByRole('button', { name: 'Xác minh xong · mô phỏng' }).click();
  await expect(event.locator('.auto-status')).toHaveAttribute('data-auto-phase', 'CHECKOUT');
  await expect(event.locator('main')).toHaveAttribute('data-holds', '1');
  const saved = await worker.evaluate(async () => (await chrome.storage.local.get('ticket-assistant.config.v1'))['ticket-assistant.config.v1']);
  expect(saved.preferences.quantity).toBe(2);
  expect(saved.preferences.catalog.tickets[0].id).toBe(tier.ticketClassId);
  expect(context.pages().filter(p => p.url().startsWith('https://ticket.1zone.vn/'))).toHaveLength(1);
});
