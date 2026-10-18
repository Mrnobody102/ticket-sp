import { afterEach, expect, it, vi } from 'vitest';
import { openEventTab } from '../../src/infrastructure/event-tab';

afterEach(() => vi.unstubAllGlobals());
it('ưu tiên tab sự kiện đang mở, thay vì tab cũ đứng trước trong danh sách', async () => {
  const target = 'https://ticket.1zone.vn/events/demo?calendarId=HN';
  const update = vi.fn(async () => undefined);
  vi.stubGlobal('chrome', { tabs: { query: async () => [
    { id: 1, windowId: 1, active: false, url: target },
    { id: 2, windowId: 1, active: true, url: target.replace('/events/', '/booking/') },
  ], update }, windows: { update: vi.fn(async () => undefined) } });
  expect(await openEventTab(target)).toBe(2);
  expect(update).toHaveBeenCalledExactlyOnceWith(2, { active: true });
});
it('tab đang mở khác suất không được thay thế tab đúng suất', async () => {
  const target = 'https://ticket.1zone.vn/events/demo?calendarId=HN';
  vi.stubGlobal('chrome', { tabs: { query: async () => [
    { id: 1, windowId: 1, active: false, url: target },
    { id: 2, windowId: 1, active: true, url: target.replace('=HN', '=HCM') },
  ], update: vi.fn(async () => undefined) }, windows: { update: vi.fn(async () => undefined) } });
  expect(await openEventTab(target)).toBe(1);
});
