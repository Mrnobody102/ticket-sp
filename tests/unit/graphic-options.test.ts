import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectPlatform } from '../../src/platforms/registry';
import { recommend } from '../../src/core/workflow';
import { validatePreferences } from '../../src/core/preferences';
import { verifyCatalogSelection } from '../../src/core/catalog-validation';
import type { EventPreferences } from '../../src/core/models';

const url = new URL('https://ticket.1zone.vn/events/graphic?calendarId=HN');
const quote = { id: 'ticket-hai', name: 'HAI QUÝ - EB', zoneName: 'HAI QUÝ 2', priceVnd: 2996000, seatMode: 'AUTO' as const };
const p: EventPreferences = { platform: 'onezone', eventUrl: url.href, quantity: 1, saleStartAt: new Date(0).toISOString(),
  preferredZoneLabels: [quote.name], allowAlternatives: false,
  catalog: { eventId: 'event', performanceId: 'HN', title: 'Test', venue: 'Hà Nội', startsAt: '2030-01-01T00:00:00Z', verifiedAt: 1, tickets: [quote] } };
const inspect = (preferences = p) => inspectPlatform(document, url, { preferences, progress: { phase: 'READY', message: '' } });

beforeEach(() => { vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList); });

describe('lựa chọn có đồ họa và định danh catalog', () => {
  it.each([
    '<button aria-label="HAI QUÝ 2 · 2.996.000 ₫"><img alt="" src="map.png"></button>',
    '<button><img alt="HAI QUÝ 2" src="zone.png"><span>2.996.000 ₫</span></button>',
    '<svg><g role="button" aria-label="HAI QUÝ 2 · 2.996.000 ₫"><rect width="50" height="50"/></g></svg>',
    '<svg><g role="button"><title>HAI QUÝ 2 · 2.996.000 ₫</title><rect width="50" height="50"/></g></svg>',
    '<span id="name">HAI QUÝ 2</span><button aria-labelledby="name"><span>2.996.000 ₫</span></button>',
  ])('tên từ ảnh/SVG/ARIA + giá: đọc đúng hạng và thực hiện đúng một click', html => {
    document.body.innerHTML = html;
    const result = inspect();
    expect(result.snapshot.visibleOptions).toHaveLength(1);
    expect(result.snapshot.visibleOptions[0]).toMatchObject({ label: quote.name, ticketTypeId: quote.id, displayedPriceVnd: quote.priceVnd });
    expect(recommend(result.snapshot, p)).toHaveLength(1);
    const clicked = vi.fn(); result.optionElements[0]!.element.addEventListener('click', clicked);
    result.automation!.execute({ kind: 'CHOOSE', optionId: result.snapshot.visibleOptions[0]!.id });
    expect(clicked).toHaveBeenCalledOnce();
  });
  it.each([
    '<img src="zone-and-price.png" alt="Sơ đồ">',
    '<svg><path d="M0 0 L50 50"/></svg>',
    '<button><img src="zone-and-price.png" alt=""></button>',
    '<svg><g role="button" aria-label="HAI QUÝ 2"><rect width="50" height="50"/></g></svg>',
  ])('đồ họa thiếu tên hoặc giá: không tạo lựa chọn từ pixel', html => {
    document.body.innerHTML = html;
    expect(inspect().automation!.page.selectable).toEqual([]);
    expect(recommend(inspect().snapshot, p)).toEqual([]);
  });
  it('SVG hết vé/ẩn hoặc ID khác không được chọn dù trùng tên và giá', () => {
    document.body.innerHTML = '<svg><g role="button" aria-disabled="true" aria-label="HAI QUÝ 2 · 2.996.000 ₫"><rect width="50" height="50"/></g></svg>';
    expect(inspect().automation!.page.selectable).toEqual([]);
    expect(recommend(inspect().snapshot, p)).toEqual([]);
    document.body.innerHTML = '<button data-ticket-class-id="other" aria-label="HAI QUÝ 2 · 2.996.000 ₫">Chọn</button>';
    expect(recommend(inspect().snapshot, p)).toEqual([]);
    document.querySelector('button')!.hidden = true;
    expect(inspect().snapshot.visibleOptions).toEqual([]);
  });
  it('giữ alias qua lưu cấu hình; preflight phát hiện zone đổi', () => {
    expect(validatePreferences(p).catalog!.tickets[0]).toEqual(quote);
    const detail = { platform: 'onezone' as const, id: 'event', url: url.href, title: 'Test', venue: 'Hà Nội', status: 'CLOSE', currency: 'VND', performances: [{ id: 'HN', venue: 'Hà Nội', startsAt: p.catalog!.startsAt }] };
    const tickets = { eventId: 'event', performanceId: 'HN', fetchedAt: 1, tickets: [{ ...quote, zoneName: 'HAI QUÝ 3' }] };
    expect(() => verifyCatalogSelection(p, detail, tickets, 0)).toThrow('zone đã đổi');
  });
  it('hai ID cùng alias không tự phân biệt bằng tên', () => {
    document.body.innerHTML = '<button aria-label="HAI QUÝ 2 · 2.996.000 ₫">Chọn</button>';
    const ambiguous = { ...p, catalog: { ...p.catalog!, tickets: [quote, { ...quote, id: 'other' }] } };
    expect(recommend(inspect(ambiguous).snapshot, ambiguous)).toEqual([]);
  });
  it.each(['p', 'h3'])('card %s không được bỏ qua ID sai trên nút dù tên/giá khớp', heading => {
    document.body.innerHTML = `<article><${heading}>HAI QUÝ 2</${heading}><p>2.996.000 ₫</p><button data-ticket-class-id="other">Chọn</button></article>`;
    expect(recommend(inspect().snapshot, p)).toEqual([]);
  });
});
