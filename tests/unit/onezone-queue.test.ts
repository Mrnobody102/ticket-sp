import { expect, it } from 'vitest';
import { isOnezoneQueueFor } from '../../src/platforms/onezone-queue';
const p = { platform: 'onezone' as const, eventUrl: 'https://ticket.1zone.vn/events/demo?calendarId=HN' };
const destination = 'https://ticket.1zone.vn/booking/demo?calendarId=HN';
it('khớp đích booking của phòng chờ; không cần đọc token', () => {
  expect(isOnezoneQueueFor('https://queue.1zone.vn/?t=' + encodeURIComponent(destination), p)).toBe(true);
});
it.each(['https://evil.test/', 'https://ticket.1zone.vn/booking/demo?calendarId=HCM',
  'https://ticket.1zone.vn/booking/other?calendarId=HN', 'https://user:pass@ticket.1zone.vn/booking/demo?calendarId=HN'])('từ chối đích khác hoặc có thông tin đăng nhập: %s', target => {
  expect(isOnezoneQueueFor('https://queue.1zone.vn/?t=' + encodeURIComponent(target), p)).toBe(false);
});
it('từ chối origin không phải phòng chờ chính thức', () => {
  expect(isOnezoneQueueFor('https://queue.1zone.vn.evil.test/?t=' + encodeURIComponent(destination), p)).toBe(false);
});
