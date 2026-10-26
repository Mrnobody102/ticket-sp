import { expect, it } from 'vitest';
import { isOnezoneQueueFor } from '../../src/platforms/onezone-queue';
const p = { platform: 'onezone' as const, eventUrl: 'https://ticket.1zone.vn/events/demo?calendarId=HN' };
const destination = 'https://ticket.1zone.vn/booking/demo?calendarId=HN';
it('khớp đích booking của phòng chờ; không cần đọc token', () => {
  expect(isOnezoneQueueFor('https://queue.1zone.vn/?t=' + encodeURIComponent(destination), p)).toBe(true);
});
it('khớp route thật CAPITANEUS, kể cả trang softblock của Queue-it', () => {
  const target = { platform: 'onezone' as const, eventUrl: 'https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6', catalog: { eventId: 'kAapup' } };
  const queue = 'https://queue.1zone.vn/softblock/?c=eventista&e=kaapup&t=' + encodeURIComponent(target.eventUrl.replace('/events/', '/booking/'));
  expect(isOnezoneQueueFor(queue, target as Parameters<typeof isOnezoneQueueFor>[1])).toBe(true);
  expect(isOnezoneQueueFor(queue.replace('kaapup', 'other'), target as Parameters<typeof isOnezoneQueueFor>[1])).toBe(false);
});
it.each(['https://evil.test/', 'https://ticket.1zone.vn/booking/demo?calendarId=HCM',
  'https://ticket.1zone.vn/booking/other?calendarId=HN', 'https://user:pass@ticket.1zone.vn/booking/demo?calendarId=HN'])('từ chối đích khác hoặc có thông tin đăng nhập: %s', target => {
  expect(isOnezoneQueueFor('https://queue.1zone.vn/?t=' + encodeURIComponent(target), p)).toBe(false);
});
it('từ chối origin không phải phòng chờ chính thức', () => {
  expect(isOnezoneQueueFor('https://queue.1zone.vn.evil.test/?t=' + encodeURIComponent(destination), p)).toBe(false);
});
