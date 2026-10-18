import { describe, expect, it } from 'vitest';
import { createCampReport } from '../../src/core/camp-report';
import { preferencesKey, type AutoRun } from '../../src/core/automation';
import type { EventPreferences, PageSnapshot } from '../../src/core/models';

const p: EventPreferences = { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo?calendarId=HN&token=private-token#private-fragment',
  saleStartAt: '2026-10-18T05:00:00Z', quantity: 2, preferredZoneLabels: ['VIP'], allowAlternatives: false };
const snapshot: PageSnapshot = { url: 'https://ticket.1zone.vn/checkout?orderToken=private-order', state: 'CHECKOUT',
  supported: true, selectionMode: 'ZONE_ONLY', visibleOptions: [], reason: 'Kiểm tra đơn.' };
const run: AutoRun = { id: 'run', revision: 4, tabId: 123, preferencesKey: preferencesKey(p), startedAt: 1000, expiresAt: 9000,
  progress: { phase: 'CHECKOUT', message: 'Đã tới thanh toán.', selectionStartedAt: 2000, checkoutReachedAt: 2250,
    chosen: { label: 'VIP', kind: 'ZONE', displayedPriceVnd: 1000000 } } };

describe('báo cáo phiên camp', () => {
  it('giữ số vé yêu cầu, bằng chứng thực tế và thời gian; không xuất cấu hình thô hoặc URL token', () => {
    const report = createCampReport('0.5.5', p, snapshot, run, undefined, undefined, 3000);
    expect(report.requested).toMatchObject({ quantity: 2, eventUrl: 'https://ticket.1zone.vn/events/demo?calendarId=HN' });
    expect(report.page.url).toBe('https://ticket.1zone.vn/checkout');
    expect(report.page.observedQuantity).toBeUndefined(); // Do not present requested quantity as observed checkout quantity.
    expect(report.run).toMatchObject({ preferencesMatch: true, phase: 'CHECKOUT', selectionToCheckoutMs: 250, chosen: { label: 'VIP' } });
    const json = JSON.stringify(report);
    for (const secret of ['private-token', 'private-order', 'private-fragment', 'preferencesKey', 'tabId']) expect(json).not.toContain(secret);
  });
  it('phiên tạm dừng không có thời gian checkout giả, cấu hình đổi được đánh dấu', () => {
    const paused = { ...run, progress: { ...run.progress, phase: 'PAUSED' as const, checkoutReachedAt: undefined } };
    const report = createCampReport('0.5.5', { ...p, quantity: 1 }, { ...snapshot, state: 'CHALLENGE' }, paused, 2, 'Cần xác minh', 3000);
    expect(report.run).toMatchObject({ preferencesMatch: false, phase: 'PAUSED' });
    expect(report.run!.selectionToCheckoutMs).toBeUndefined();
    expect(report.page.observedQuantity).toBe(2);
    expect(report.error).toBe('Cần xác minh');
  });
  it('chưa bật camp không tạo phiên hoặc kết quả thành công', () => {
    const report = createCampReport('0.5.5', null, { ...snapshot, state: 'NOT_READY' }, null, undefined, undefined, 3000);
    expect(report.run).toBeNull();
    expect(report.requested).toBeNull();
    expect(report.page.state).toBe('NOT_READY');
  });
});
