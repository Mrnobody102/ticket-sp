import { describe, expect, it } from 'vitest';
import { effectiveSnapshot, recommend, reminderIsDue, reminderKey } from '../../src/core/workflow';
import type { EventPreferences, PageSnapshot, TaskConfig } from '../../src/core/models';

const p: EventPreferences = {
  platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo', saleStartAt: '2026-10-18T05:00:00Z',
  quantity: 2, preferredZoneLabels: ['VIP', 'Khu A'], allowAlternatives: false,
};
const config: TaskConfig = { schemaVersion: 1, preferences: p, enabled: true, panelVisible: true };
const snapshot: PageSnapshot = {
  url: p.eventUrl, state: 'SELECTING', selectionMode: 'ZONE_ONLY', supported: true, reason: '', maxQuantity: 2,
  visibleOptions: [
    { id: 'a', kind: 'ZONE', label: 'Khu A', displayedPriceVnd: 800000, displayedAvailability: 'AVAILABLE' },
    { id: 'v', kind: 'ZONE', label: 'VIP', displayedPriceVnd: 1200000, displayedAvailability: 'AVAILABLE' },
    { id: 'vv', kind: 'ZONE', label: 'VVIP', displayedPriceVnd: 2000000, displayedAvailability: 'AVAILABLE' },
    { id: 'b', kind: 'ZONE', label: 'Khu B', displayedPriceVnd: 500000, displayedAvailability: 'UNAVAILABLE' },
  ],
};
describe('gợi ý và nhắc giờ', () => {
  it('tôn trọng thứ tự ưu tiên, không lẫn VIP với VVIP', () => { expect(recommend(snapshot, p).map(r => r.option.id)).toEqual(['v', 'a']); });
  it('tính ngân sách theo tổng số vé', () => { expect(recommend(snapshot, { ...p, maxTotalVnd: 1700000 }).map(r => r.option.id)).toEqual(['a']); });
  it('không gợi ý giá mơ hồ khi có ngân sách', () => {
    const unknownPrice = { ...snapshot, visibleOptions: [{ ...snapshot.visibleOptions[0]!, displayedPriceVnd: undefined }] };
    expect(recommend(unknownPrice, { ...p, maxTotalVnd: 5000000 })).toEqual([]);
  });
  it.each(['CHALLENGE', 'WAITING_ROOM', 'CHECKOUT', 'UNKNOWN', 'STOPPED'] as const)('không highlight ở %s', state => { expect(recommend({ ...snapshot, state }, p)).toEqual([]); });
  it('chặn gợi ý vượt giới hạn số vé hiển thị', () => { expect(recommend(snapshot, { ...p, quantity: 3 })).toEqual([]); });
  it('chỉ thêm phương án thay thế khi được cấu hình', () => { expect(recommend(snapshot, { ...p, allowAlternatives: true }).map(r => r.option.id)).toEqual(['v', 'a', 'vv']); });
  it('ghế có zone rõ ràng khớp ưu tiên zone, không coi một ghế là nhóm nhiều vé', () => {
    const seats: PageSnapshot = { ...snapshot, selectionMode: 'PICK_SEAT', visibleOptions: [
      { id: 's1', kind: 'SEAT', label: 'A1', zoneLabel: 'Khu A', displayedPriceVnd: 800000, displayedAvailability: 'AVAILABLE' },
    ] };
    expect(recommend(seats, { ...p, quantity: 1 })[0]?.estimatedTotalVnd).toBe(800000);
    expect(recommend(seats, { ...p, quantity: 2 })).toEqual([]);
    expect(recommend({ ...seats, visibleOptions: [{ ...seats.visibleOptions[0]!, zoneLabel: 'Khu A2' }] }, { ...p, quantity: 1 })).toEqual([]);
  });
  it('không gợi ý lại lựa chọn đã được đánh dấu chọn', () => {
    expect(recommend({ ...snapshot, visibleOptions: snapshot.visibleOptions.map(o => ({ ...o, selected: true })) }, p)).toEqual([]);
  });
  it('dừng và sai event được ưu tiên so với trạng thái DOM', () => {
    expect(effectiveSnapshot(snapshot, { ...config, enabled: false }).state).toBe('STOPPED');
    expect(effectiveSnapshot({ ...snapshot, url: p.eventUrl + '-other' }, config).supported).toBe(false);
  });
  it.each(['WAITING_ROOM', 'CHALLENGE', 'CHECKOUT'] as const)('giữ trạng thái %s khi URL không còn định danh event, nhưng không gợi ý', state => {
    const result = effectiveSnapshot({ ...snapshot, state, url: 'https://ticket.1zone.vn/waiting-room', reason: 'Trạng thái trên trang.' }, config);
    expect(result.state).toBe(state);
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('Chưa xác nhận');
    expect(recommend(result, p)).toEqual([]);
  });
  it('nhắc một lần sau mở bán, bỏ qua nhắc quá cũ và tác vụ đã dừng', () => {
    const at = Date.parse(p.saleStartAt);
    expect(reminderIsDue(config, undefined, at - 1)).toBe(false);
    expect(reminderIsDue(config, undefined, at)).toBe(true);
    expect(reminderIsDue(config, reminderKey(p), at)).toBe(false);
    expect(reminderIsDue(config, undefined, at + 16 * 60000)).toBe(false);
    expect(reminderIsDue({ ...config, enabled: false }, undefined, at)).toBe(false);
  });
});
