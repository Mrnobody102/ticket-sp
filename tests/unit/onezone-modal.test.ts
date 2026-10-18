import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installOnezoneDemo } from '../../src/testing/onezone-demo';
import { inspectPlatform } from '../../src/platforms/registry';
import { inspectOnezonePage } from '../../src/platforms/onezone';
import { inspectAutoControls } from '../../src/platforms/onezone-automation';
import type { EventPreferences } from '../../src/core/models';

const p: EventPreferences = { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo?calendarId=HN', saleStartAt: new Date(0).toISOString(), quantity: 2, preferredZoneLabels: ['HAI QUÝ - EB'], allowAlternatives: false,
  catalog: { eventId: 'test', performanceId: 'HN', title: 'Demo', venue: 'Hà Nội', startsAt: '2030-01-01T00:00:00Z', verifiedAt: 1, tickets: [{ id: 'hai-quy', name: 'HAI QUÝ - EB', priceVnd: 2996000, seatMode: 'AUTO' }] } };
const progress = { phase: 'READY' as const, message: '' };
const inspect = () => inspectPlatform(document, new URL(p.eventUrl), { preferences: p, progress });
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  document.documentElement.innerHTML = new DOMParser().parseFromString(readFileSync('fixtures/onezone-modal.html', 'utf8'), 'text/html').documentElement.innerHTML;
  installOnezoneDemo(document);
});
describe('component modal 1Zone theo dấu hiệu công khai', () => {
  it.each(['data-ticket-class-id', 'data-ticket-type-id', 'data-zone-id'])('modal tên/giá đúng nhưng %s mâu thuẫn: chặn generic advance', attribute => {
    document.querySelector('#ticket-list button')!.dispatchEvent(new MouseEvent('click'));
    document.querySelector('[role="dialog"]')!.setAttribute(attribute, 'wrong-id');
    expect(inspect().automation!.page.problem).toContain('Chưa xác minh');
  });
  it('modal chỉ hiện tên hạng, có zone ID hợp lệ: giữ khu cụ thể theo map đã xác minh', () => {
    document.querySelector('#ticket-list button')!.dispatchEvent(new MouseEvent('click'));
    document.querySelector('[role="dialog"]')!.setAttribute('data-zone-id', 'zone-1');
    document.querySelector('[role="dialog"]')!.setAttribute('data-ticket-class-id', 'hai-quy');
    const mapped = { ...p, catalog: { ...p.catalog!, tickets: [{ ...p.catalog!.tickets[0]!, zones: [{ id: 'zone-1', name: 'HAI QUÝ 1' }] }] } };
    expect(inspectPlatform(document, new URL(p.eventUrl), { preferences: mapped, progress }).snapshot.visibleOptions[0]?.zoneLabel).toBe('HAI QUÝ 1');
  });
  it('tên khu và zone ID đều thuộc hạng nhưng trỏ hai khu khác nhau: dừng', () => {
    document.querySelector('#ticket-list button')!.dispatchEvent(new MouseEvent('click'));
    document.querySelector('[role="dialog"] > p')!.textContent = 'HAI QUÝ 1';
    document.querySelector('[role="dialog"]')!.setAttribute('data-zone-id', 'zone-2');
    const mapped = { ...p, catalog: { ...p.catalog!, tickets: [{ ...p.catalog!.tickets[0]!, zones: [1, 2].map(index => ({ id: `zone-${index}`, name: `HAI QUÝ ${index}` })) }] } };
    expect(inspectPlatform(document, new URL(p.eventUrl), { preferences: mapped, progress }).automation!.page.problem).toContain('Chưa xác minh');
  });
  it('đọc thẻ dùng p, xác nhận modal thay cho selected ARIA và đặt stepper span', () => {
    const first = inspect();
    expect(first.snapshot).toMatchObject({ state: 'SELECTING', selectionMode: 'ASSIGNED_SEAT', visibleOptions: [{ label: 'HAI QUÝ - EB', displayedPriceVnd: 2996000 }] });
    first.automation!.execute({ kind: 'CHOOSE', optionId: first.automation!.page.selectable[0]! });
    const modal = inspect(); expect(modal.snapshot.visibleOptions).toMatchObject([{ selected: true, displayedPriceVnd: 2996000 }]);
    expect(modal.automation!.page.quantity).toMatchObject({ value: 1, stepper: true });
    modal.automation!.execute({ kind: 'QUANTITY', value: 2 });
    expect(inspect().automation!.page.quantity).toMatchObject({ value: 2, max: 2 });
    expect(inspect().automation!.page.advanceCount).toBe(1);
  });
  it('không lấy giá gốc hoặc tổng tiền làm đơn giá; giá đổi thì không xác nhận lựa chọn', () => {
    document.querySelector('#ticket-list button')!.dispatchEvent(new MouseEvent('click'));
    const old = inspect(); expect(old.snapshot.visibleOptions[0]?.displayedPriceVnd).toBe(2996000);
    document.querySelector('[role="dialog"] > div > div > span')!.textContent = '3.100.000 ₫';
    expect(inspect().snapshot.visibleOptions.some(o => o.selected)).toBe(false);
  });
  it('CTA chính loại bản sticky trùng; các nút mua không rõ vẫn giữ là nhiều lựa chọn', () => {
    document.body.innerHTML = '<h1>Fan meeting</h1><button data-id="btn-by-ticket">Mua vé</button><button>Mua vé</button>';
    expect(inspectAutoControls(document, inspectOnezonePage(document, new URL(p.eventUrl)), p, progress).page.enterCount).toBe(1);
    document.querySelector('[data-id]')!.removeAttribute('data-id');
    expect(inspectAutoControls(document, inspectOnezonePage(document, new URL(p.eventUrl)), p, progress).page.enterCount).toBe(2);
  });
  it('quote không ghi đè dấu đã chọn của thẻ ngữ nghĩa', () => {
    document.body.innerHTML = '<main><h1>Chọn khu vực</h1><p>Không chọn chỗ</p><article><h3>HAI QUÝ - EB</h3><p>2.996.000 ₫</p><button aria-pressed="true">Chọn</button></article></main>';
    expect(inspect().snapshot.visibleOptions[0]?.selected).toBe(true);
  });
});
