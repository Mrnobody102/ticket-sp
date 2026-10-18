import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachOnezoneZones, createOnezoneCatalog, parseOnezoneTickets, parseOnezoneDetail } from '../../src/platforms/onezone-catalog';
import { validatePreferences } from '../../src/core/preferences';
import { verifyCatalogSelection } from '../../src/core/catalog-validation';
import { decideAutomation, preferencesKey, sameOption, type AutoRun } from '../../src/core/automation';
import { inspectPlatform } from '../../src/platforms/registry';
import { catalogUrl, ticketData, ticketReply, calendar, eventData, flightHtml } from '../fixtures/catalog';
import type { EventPreferences } from '../../src/core/models';
import { ticketHasLabel } from '../../src/core/ticket-identity';

const zones = [1, 2].map(index => ({ id: `zone-${index}`, name: `VIP ${index}`, ticketClassId: ticketData.ticketClassId, eventId: 'event-test', calendarId: 'HN' }));
const catalog = () => attachOnezoneZones({ errorCode: 0, data: zones }, parseOnezoneTickets(ticketReply(), 'event-test', 'HN'), ['vip-test']);
function preferences(): EventPreferences {
  return validatePreferences({ platform: 'onezone', eventUrl: catalogUrl + '?calendarId=HN', saleStartAt: new Date(0).toISOString(), quantity: 1, preferredZoneLabels: ['VIP'], allowAlternatives: false,
    catalog: { eventId: 'event-test', performanceId: 'HN', title: eventData.name, venue: calendar().location, startsAt: calendar().startDate, verifiedAt: 1, tickets: catalog().tickets } });
}
beforeEach(() => { vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList); });
describe('một hạng có nhiều khu trên sơ đồ', () => {
  it('GET summary + zones và ghép theo class ID, giữ đủ khu thay vì zone đại diện', async () => {
    const read = vi.fn(async (url: string) => url.includes('/zones?') ? { errorCode: 0, data: zones } : ticketReply([{ ...ticketData, ticketType: 'seatmap_zone', zoneName: 'VIP 2' }]));
    const result = await createOnezoneCatalog(read).tickets('event-test', 'HN');
    expect(result.tickets[0]?.zones).toEqual([{ id: 'zone-1', name: 'VIP 1' }, { id: 'zone-2', name: 'VIP 2' }]);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1]?.[0]).toContain('/get-summary-event/event-test/zones?calendarId=HN');
  });
  it.each([
    { data: [{ ...zones[0], eventId: 'wrong' }] }, { data: [{ ...zones[0], calendarId: 'HCM' }] },
    { data: [zones[0], zones[0]] }, { data: [{ ...zones[0], name: '' }] },
    { data: [zones[0], { ...zones[1], name: 'VIP 1' }] }, { data: [] },
  ])('từ chối zone sai suất/ID/tên mơ hồ hoặc thiếu ánh xạ', ({ data }) => {
    expect(() => attachOnezoneZones({ errorCode: 0, data }, parseOnezoneTickets(ticketReply(), 'event-test', 'HN'), ['vip-test'])).toThrow();
  });
  it('preflight không phụ thuộc thứ tự/zone đại diện nhưng chặn đổi ánh xạ và cấu hình cũ', () => {
    const p = preferences();
    const detail = parseOnezoneDetail(flightHtml(), p.eventUrl);
    const fresh = catalog(); fresh.tickets[0]!.zones!.reverse(); fresh.tickets[0]!.zoneName = 'VIP 2';
    expect(() => verifyCatalogSelection(p, detail, fresh, 0)).not.toThrow();
    fresh.tickets[0]!.zones![0]!.name = 'VIP 3';
    expect(() => verifyCatalogSelection(p, detail, fresh, 0)).toThrow('zone đã đổi');
    const legacy = structuredClone(p); delete legacy.catalog!.tickets[0]!.zones;
    expect(() => verifyCatalogSelection(legacy, detail, catalog(), 0)).toThrow('Tải lại hạng vé');
  });
  it('hai khu cùng class/giá là hai lựa chọn; modal phải xác nhận đúng khu vừa chọn', () => {
    const p = preferences();
    document.body.innerHTML = '<h1>Chọn khu vực</h1><p>Ghế được tự động cấp</p><button aria-label="VIP 1 · 1.200.000 ₫">Chọn</button><button aria-label="VIP 2 · 1.200.000 ₫">Chọn</button>';
    const view = inspectPlatform(document, new URL(p.eventUrl), { preferences: p, progress: { phase: 'READY', message: '' } });
    const [first, second] = view.snapshot.visibleOptions;
    expect(first).toMatchObject({ label: 'VIP', ticketTypeId: 'vip-test', zoneLabel: 'VIP 1' });
    expect(second).toMatchObject({ label: 'VIP', ticketTypeId: 'vip-test', zoneLabel: 'VIP 2' });
    expect(sameOption(first!, second!)).toBe(false);
    const run: AutoRun = { id: 'r', tabId: 1, revision: 0, preferencesKey: preferencesKey(p), startedAt: 0, expiresAt: 100000, progress: { phase: 'READY', message: '' } };
    expect(decideAutomation(run, view.automation!.page, p, 1)).toMatchObject({ type: 'STEP', action: { kind: 'CHOOSE', optionId: first!.id } });
    expect(sameOption({ ...first!, zoneLabel: undefined }, second!)).toBe(true); // A class choice permits any verified member zone.
  });
  it('không dùng data-zone-id trái với tên khu đã đối chiếu', () => {
    const p = preferences();
    document.body.innerHTML = '<button data-zone-id="zone-2" aria-label="VIP 1 · 1.200.000 ₫">Chọn</button>';
    expect(inspectPlatform(document, new URL(p.eventUrl), { preferences: p, progress: { phase: 'READY', message: '' } }).snapshot.visibleOptions).toEqual([]);
  });
  it('nhãn khu VIP 1 và hướng dẫn chọn chỗ chung không bị suy thành ghế VIP1 khi API cấp ghế tự động', () => {
    const p = preferences();
    document.body.innerHTML = '<h1>Chọn vị trí chỗ ngồi trên sơ đồ</h1><canvas></canvas><button aria-label="VIP 1 · 1.200.000 ₫">Chọn</button><button aria-label="VIP 2 · 1.200.000 ₫">Chọn</button>';
    const result = inspectPlatform(document, new URL(p.eventUrl), { preferences: p, progress: { phase: 'READY', message: '' } });
    expect(result.snapshot).toMatchObject({ state: 'SELECTING', selectionMode: 'ASSIGNED_SEAT', supported: true });
    expect(result.snapshot.visibleOptions.every(option => option.kind === 'ZONE')).toBe(true);
  });
  it('không giữ alias đại diện ngoài danh sách zone đã xác minh', () => {
    expect(ticketHasLabel({ ...preferences().catalog!.tickets[0]!, zoneName: 'VIP 99' }, 'VIP 99')).toBe(false);
  });
  it('cùng lúc có thẻ hạng và khu cụ thể: chọn khu trước để không nhầm điều khiển trùng', () => {
    const p = preferences();
    document.body.innerHTML = '<button aria-label="VIP · 1.200.000 ₫">Chọn</button><button aria-label="VIP 1 · 1.200.000 ₫">Chọn</button>';
    const view = inspectPlatform(document, new URL(p.eventUrl), { preferences: p, progress: { phase: 'READY', message: '' } });
    const physical = view.snapshot.visibleOptions.find(option => option.zoneLabel === 'VIP 1')!;
    const run: AutoRun = { id: 'r', tabId: 1, revision: 0, preferencesKey: preferencesKey(p), startedAt: 0, expiresAt: 100000, progress: { phase: 'READY', message: '' } };
    expect(decideAutomation(run, view.automation!.page, p, 1)).toMatchObject({ type: 'STEP', action: { kind: 'CHOOSE', optionId: physical.id } });
  });
});
