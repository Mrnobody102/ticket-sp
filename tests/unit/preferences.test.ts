import { describe, expect, it } from 'vitest';
import { eventUrl, fromVietnamLocal, isSameEvent, parseStoredConfig, toVietnamLocal, validatePreferences } from '../../src/core/preferences';
import { DEFAULT_CONFIG } from '../../src/core/models';

export const preferences = {
  platform: 'onezone' as const, eventUrl: 'https://ticket.1zone.vn/events/demo',
  saleStartAt: '2026-10-18T12:00:00+07:00', quantity: 2, preferredZoneLabels: ['VIP', 'Khu A'], allowAlternatives: false,
};

describe('cấu hình và đúng sự kiện', () => {
  it.each(['http://ticket.1zone.vn/events/demo', 'https://ticket.1zone.vn.evil.test/events/demo', 'https://shop.1zone.vn/events/demo', 'javascript:alert(1)', 'https://ticket.1zone.vn/', 'https://u:p@ticket.1zone.vn/events/demo', 'https://ticket.1zone.vn:444/events/demo'])('từ chối URL không phù hợp: %s', value => {
    expect(() => eventUrl(value)).toThrow();
  });
  it('giữ suất diễn, bỏ dữ liệu tracking', () => {
    expect(eventUrl(preferences.eventUrl + '/?calendarId=ABC&utm_source=x#token').href).toBe(preferences.eventUrl + '?calendarId=ABC');
  });
  it('chuẩn hóa link booking thành event, vẫn giữ đúng suất diễn', () => {
    expect(eventUrl('https://ticket.1zone.vn/booking/demo?calendarId=A&utm_source=test').href)
      .toBe(preferences.eventUrl + '?calendarId=A');
  });
  it('phân biệt event prefix và suất diễn', () => {
    expect(isSameEvent(preferences.eventUrl + '-other', preferences.eventUrl)).toBe(false);
    expect(isSameEvent(preferences.eventUrl + '/select', preferences.eventUrl)).toBe(true);
    expect(isSameEvent(preferences.eventUrl + '?calendarId=B', preferences.eventUrl + '?calendarId=A')).toBe(false);
    expect(isSameEvent(preferences.eventUrl, preferences.eventUrl + '?calendarId=A')).toBe(false);
  });
  it('đi từ event sang booking cùng slug và suất, không lẫn event hoặc thành phố khác', () => {
    const target = preferences.eventUrl + '?calendarId=HANOI';
    expect(isSameEvent('https://ticket.1zone.vn/booking/demo?calendarId=HANOI', target)).toBe(true);
    expect(isSameEvent('https://ticket.1zone.vn/booking/demo/seats?calendarId=HANOI', target)).toBe(true);
    expect(isSameEvent('https://ticket.1zone.vn/booking/demo?calendarId=HCM', target)).toBe(false);
    expect(isSameEvent('https://ticket.1zone.vn/booking/demo?calendarId=HANOI,', target)).toBe(false);
    expect(isSameEvent('https://ticket.1zone.vn/booking/demo-other?calendarId=HANOI', target)).toBe(false);
    expect(isSameEvent('https://example.com/booking/demo?calendarId=HANOI', target)).toBe(false);
  });
  it('luôn diễn giải giờ nhập bằng UTC+7, không phụ thuộc timezone máy', () => {
    expect(fromVietnamLocal('2026-10-18T12:00')).toBe('2026-10-18T05:00:00.000Z');
    expect(toVietnamLocal('2026-10-18T05:00:00.000Z')).toBe('2026-10-18T12:00');
    expect(() => fromVietnamLocal('2026-02-30T12:00')).toThrow();
  });
  it.each([{ quantity: 1.2 }, { quantity: 0 }, { maxTotalVnd: -1 }, { maxTotalVnd: NaN }, { saleStartAt: '2026-10-18T12:00' }, { preferredZoneLabels: [''] }])('từ chối cấu hình lỗi %j', patch => {
    expect(() => validatePreferences({ ...preferences, ...patch })).toThrow();
  });
  it('khôi phục về trạng thái tắt nếu storage sai schema / dữ liệu hỏng', () => {
    expect(parseStoredConfig({ ...DEFAULT_CONFIG, schemaVersion: 2 })).toEqual(DEFAULT_CONFIG);
    expect(parseStoredConfig({ ...DEFAULT_CONFIG, preferences: { eventUrl: 'bad' }, enabled: true })).toEqual(DEFAULT_CONFIG);
  });
});
