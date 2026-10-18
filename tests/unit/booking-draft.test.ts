import { describe, expect, it } from 'vitest';
import { emptyBookingDraft, parseBookingDraft } from '../../src/core/booking-draft';
import { parseOnezoneDetail, parseOnezoneTickets } from '../../src/platforms/onezone-catalog';
import { catalogUrl, flightHtml, ticketReply } from '../fixtures/catalog';

describe('bản nháp cấu hình', () => {
  it('giữ trường nhập dở, danh sách đã tải, thứ tự ưu tiên và kết quả tìm kiếm', () => {
    const detail = parseOnezoneDetail(flightHtml(), catalogUrl);
    const catalog = parseOnezoneTickets(ticketReply(), detail.id, 'HN');
    const form = { ...emptyBookingDraft(), url: catalogUrl + '?calendarId=HN', quantity: '', budget: '3000000', immediate: true,
      selectedTickets: ['vip-test'], loaded: { detail, performance: detail.performances[0]!, catalog },
      finder: { ...emptyBookingDraft().finder, query: 'Vương Bình', detail, tickets: catalog, performanceId: 'HN', showResults: false } };
    expect(parseBookingDraft({ schemaVersion: 1, baseKey: 'saved', dirty: true, form }, 'saved')).toEqual({ form, dirty: true });
  });
  it('bản nháp dựa trên cấu hình cũ không ghi đè cấu hình mới từ cửa sổ khác', () => {
    expect(parseBookingDraft({ schemaVersion: 1, baseKey: 'old', dirty: true, form: emptyBookingDraft() }, 'new')).toBeNull();
  });
  it.each([null, { schemaVersion: 1, baseKey: 'saved', dirty: true, form: { ...emptyBookingDraft(), selectedTickets: 'VIP' } },
    { schemaVersion: 1, baseKey: 'saved', dirty: true, form: { ...emptyBookingDraft(), finder: { ...emptyBookingDraft().finder, detail: {} } } }])('bỏ dữ liệu hỏng để popup vẫn mở được', value => {
    expect(parseBookingDraft(value, 'saved')).toBeNull();
  });
});
