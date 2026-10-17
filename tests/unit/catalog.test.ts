import { describe, expect, it, vi } from 'vitest';
import { createOnezoneCatalog, parseOnezoneDetail, parseOnezoneTickets } from '../../src/platforms/onezone-catalog';
import { createTicketboxCatalog } from '../../src/platforms/ticketbox-catalog';
import { validatePreferences } from '../../src/core/preferences';
import { verifyCatalogSelection } from '../../src/core/catalog-validation';
import { recommend } from '../../src/core/workflow';
import type { EventPreferences, PageSnapshot } from '../../src/core/models';
import { calendar, catalogUrl, eventData, flightHtml, searchItem, ticketData, ticketReply, ticketboxData, ticketboxReply, ticketboxUrl } from '../fixtures/catalog';

const detail = () => parseOnezoneDetail(flightHtml(), catalogUrl);
const catalog = () => parseOnezoneTickets(ticketReply(), 'event-test', 'HN', 100);
const preferences = (): EventPreferences => ({ platform: 'onezone', eventUrl: catalogUrl + '?calendarId=HN', saleStartAt: new Date(0).toISOString(), quantity: 1, preferredZoneLabels: ['VIP'], allowAlternatives: false,
  catalog: { eventId: 'event-test', performanceId: 'HN', title: eventData.name, venue: calendar().location, startsAt: calendar().startDate, verifiedAt: 100, tickets: [{ id: 'vip-test', name: 'VIP', priceVnd: 1200000 }] } });

describe('đọc nguồn 1Zone', () => {
  it('đọc JSON flight, giữ ID suất và phân biệt giờ diễn với giờ bán', () => {
    expect(detail()).toMatchObject({ id: 'event-test', performances: [{ id: 'HN', startsAt: calendar().startDate, venue: calendar().location, maxQuantity: 2 }] });
    expect(detail()).not.toHaveProperty('saleStartAt');
  });
  it('đọc JSON chứa dấu ngoặc, dấu nháy và chuỗi escape mà không chạy script', () => {
    const name = 'Vé {"VIP"} \\ thử nghiệm';
    expect(parseOnezoneDetail(flightHtml({ ...eventData, name }), catalogUrl).title).toBe(name);
    const execute = vi.fn(); vi.stubGlobal('executeUntrustedCode', execute);
    expect(() => parseOnezoneDetail('<script>executeUntrustedCode()</script>', catalogUrl)).toThrow('chưa có dữ liệu');
    expect(execute).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
  it.each([
    { ...eventData, pathName: 'wrong-event' },
    { ...eventData, eventCalendar: [calendar(), calendar()] },
    { ...eventData, eventCalendar: [{ ...calendar(), eventId: 'other' }] },
    { ...eventData, eventCalendar: [{ ...calendar(), startDate: 'invalid' }] },
  ])('từ chối metadata sai event, trùng suất hoặc ngày lỗi', data => {
    expect(() => parseOnezoneDetail(flightHtml(data), catalogUrl)).toThrow();
  });
  it('chỉ đọc đúng event/suất và đúng giá cuối, giữ giá 0', () => {
    expect(catalog().tickets[0]).toMatchObject({ id: 'vip-test', priceVnd: 1200000, seatMode: 'AUTO', requiresChallenge: true });
    expect(parseOnezoneTickets(ticketReply([{ ...ticketData, finalPriceVn: 0 }]), 'event-test', 'HN').tickets[0]?.priceVnd).toBe(0);
    expect(() => parseOnezoneTickets(ticketReply(), 'other', 'HN')).toThrow('khác');
    expect(() => parseOnezoneTickets(ticketReply(), 'event-test', 'HCM')).toThrow('khác');
  });
  it('không nhận giá dạng chuỗi, ID trùng hoặc envelope lỗi; bỏ hạng bị ẩn', () => {
    expect(() => parseOnezoneTickets(ticketReply([{ ...ticketData, finalPriceVn: '1200000' }]), 'event-test', 'HN')).toThrow('giá');
    expect(() => parseOnezoneTickets(ticketReply([ticketData, ticketData]), 'event-test', 'HN')).toThrow('trùng');
    expect(() => parseOnezoneTickets({ errorCode: 1, data: [] }, 'event-test', 'HN')).toThrow();
    expect(parseOnezoneTickets(ticketReply([{ ...ticketData, isShowInBooking: false }]), 'event-test', 'HN').tickets).toEqual([]);
  });
  it('tìm qua API server, mã hóa từ khóa, không nhận link ngoài', async () => {
    const read = vi.fn(async (_url: string) => ({ errorCode: 0, data: { ticketEvents: [searchItem, { ...searchItem, path: '//evil.com' }] } }));
    const result = await createOnezoneCatalog(read).search('Vương Bình & Hà Nội', 1);
    const url = new URL(read.mock.calls[0]![0] as string);
    expect(url.pathname).toBe('/v2/marketplace/search'); expect(url.searchParams.get('keyword')).toBe('Vương Bình & Hà Nội');
    expect(result.items).toHaveLength(1); expect(result.items[0]?.url).toBe(catalogUrl);
  });
});

describe('Ticketbox là nguồn tra cứu riêng', () => {
  it('đọc đúng schema search và detail/showing/ticketType', async () => {
    const provider = createTicketboxCatalog(async url => url.includes('/search/') ? { code: 200, data: { results: [{ id: 26657, name: 'Ticketbox thử nghiệm', deeplink: ticketboxUrl + '?utm_source=test', day: calendar().startDate }], total: { filtered: 1 } } } : ticketboxReply());
    expect((await provider.search('Hà Nội', 1)).items[0]?.url).toBe(ticketboxUrl);
    expect((await provider.detail(ticketboxUrl)).performances[0]?.id).toBe('53858377012103');
    expect((await provider.tickets('26657', '53858377012103')).tickets[0]).toMatchObject({ id: '100001', priceVnd: 2000000, seatMode: 'UNKNOWN' });
    await expect(provider.detail('https://evil.com/catalog-test-26657')).rejects.toThrow('Link');
    await expect(provider.tickets('26657', '999')).rejects.toThrow('suất');
  });
  it('từ chối ID sự kiện trả về sai và ID vé vượt safe integer', async () => {
    await expect(createTicketboxCatalog(async () => ticketboxReply({ ...ticketboxData, id: 999 })).tickets('26657', '53858377012103')).rejects.toThrow('khớp');
    const data = { ...ticketboxData, showings: [{ ...ticketboxData.showings[0]!, ticketTypes: [{ id: Number.MAX_SAFE_INTEGER + 1, name: 'VIP', price: 1 }] }] };
    await expect(createTicketboxCatalog(async () => ticketboxReply(data)).tickets('26657', '53858377012103')).rejects.toThrow('ID');
  });
  it('phân biệt envelope search code=200 và detail status=1 của Ticketbox', async () => {
    await expect(createTicketboxCatalog(async () => ({ code: 200, data: { result: ticketboxData } })).detail(ticketboxUrl)).rejects.toThrow('dữ liệu');
    await expect(createTicketboxCatalog(async () => ({ status: 1, data: { results: [] } })).search('test', 1)).rejects.toThrow('dữ liệu');
    await expect(createTicketboxCatalog(async () => ({ status: 0, data: { result: ticketboxData } })).detail(ticketboxUrl)).rejects.toThrow('dữ liệu');
  });
});

describe('cấu hình và preflight catalog', () => {
  it('chuẩn hóa nhãn từ ticket ID và vẫn đọc được cấu hình cũ', () => {
    expect(validatePreferences({ ...preferences(), preferredZoneLabels: ['Sai'] }).preferredZoneLabels).toEqual(['VIP']);
    expect(validatePreferences({ ...preferences(), catalog: undefined }).catalog).toBeUndefined();
  });
  it.each([
    { eventId: 123 }, { eventId: undefined }, { performanceId: 'HCM' }, { startsAt: 10 }, { tickets: [] },
    { tickets: [{ id: undefined, name: 'VIP', priceVnd: 1 }] }, { tickets: [{ id: 'v', name: 'VIP', priceVnd: '1' }] },
  ])('không ép kiểu ID hoặc nhận catalog không khớp suất', patch => {
    expect(() => validatePreferences({ ...preferences(), catalog: { ...preferences().catalog, ...patch } })).toThrow('Dữ liệu');
  });
  it('kiểm tra giá, thời gian, địa điểm, số vé trước khi chạy', () => {
    const p = preferences(); verifyCatalogSelection(p, detail(), catalog(), 0);
    expect(() => verifyCatalogSelection(p, detail(), { ...catalog(), tickets: [{ ...catalog().tickets[0]!, priceVnd: 1200001 }] }, 0)).toThrow('giá');
    expect(() => verifyCatalogSelection(p, { ...detail(), currency: 'USD' }, catalog(), 0)).toThrow('tiền');
    expect(() => verifyCatalogSelection(p, { ...detail(), performances: [{ ...detail().performances[0]!, venue: 'TP.HCM' }] }, catalog(), 0)).toThrow('địa điểm');
    expect(() => verifyCatalogSelection(p, detail(), catalog(), Date.parse('2031-01-01'))).toThrow('kết thúc');
    expect(() => verifyCatalogSelection({ ...p, quantity: 3 }, detail(), catalog(), 0)).toThrow('giới hạn');
    expect(() => verifyCatalogSelection({ ...p, quantity: 2 }, detail(), { ...catalog(), tickets: [{ ...catalog().tickets[0]!, maxQuantity: 1 }] }, 0)).toThrow('tối đa');
  });
  it('DOM phải khớp ID (nếu có) hoặc tên chính xác và giá đã chọn', () => {
    const page: PageSnapshot = { url: preferences().eventUrl, state: 'SELECTING', selectionMode: 'ZONE_ONLY', supported: true, reason: '', visibleOptions: [{ id: 'dom-1', kind: 'ZONE', label: 'VIP', displayedPriceVnd: 1200000, displayedAvailability: 'AVAILABLE' }] };
    expect(recommend(page, preferences())).toHaveLength(1);
    expect(recommend({ ...page, visibleOptions: [{ ...page.visibleOptions[0]!, ticketTypeId: 'other' }] }, preferences())).toEqual([]);
    expect(recommend({ ...page, visibleOptions: [{ ...page.visibleOptions[0]!, displayedPriceVnd: 1200001 }] }, preferences())).toEqual([]);
    expect(recommend({ ...page, visibleOptions: [{ ...page.visibleOptions[0]!, displayedPriceVnd: undefined }] }, preferences())).toEqual([]);
  });
});
