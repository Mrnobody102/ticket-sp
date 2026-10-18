import { expect, it } from 'vitest';
import { correctHanoiSaleDate } from '../../src/core/config-migrations';
import { DEFAULT_CONFIG, type TaskConfig } from '../../src/core/models';
import { HANOI_PRESET } from '../../src/core/task-presets';

const config = (): TaskConfig => ({ ...DEFAULT_CONFIG, enabled: true, preferences: {
  platform: 'onezone', eventUrl: HANOI_PRESET.eventUrl, saleStartAt: '2026-10-19T05:00:00Z', quantity: 2,
  preferredZoneLabels: ['ÚT CƯNG - EB'], allowAlternatives: false,
} });
it('đính chính đúng suất Hà Nội sang 12h 18/10, giữ lựa chọn và không tự tạo phiên', () => {
  const before = config();
  expect(correctHanoiSaleDate(before)).toEqual({ ...before, preferences: { ...before.preferences, saleStartAt: '2026-10-18T05:00:00.000Z' } });
  expect(before.preferences!.saleStartAt).toBe('2026-10-19T05:00:00Z');
});
it('giữ giờ tùy chỉnh, suất khác và cấu hình chưa lưu', () => {
  for (const before of [DEFAULT_CONFIG, { ...config(), preferences: { ...config().preferences!, saleStartAt: '2026-10-18T04:30:00Z' } },
    { ...config(), preferences: { ...config().preferences!, eventUrl: HANOI_PRESET.eventUrl.replace('8h0YGm', 'other') } }]) {
    expect(correctHanoiSaleDate(before)).toBe(before);
  }
});
it('chạy lại không đổi cấu hình đã sửa', () => {
  const corrected = correctHanoiSaleDate(config());
  expect(correctHanoiSaleDate(corrected)).toBe(corrected);
});
