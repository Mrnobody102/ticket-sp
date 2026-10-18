import { describe, expect, it } from 'vitest';
import { decideAutomation, preferencesKey, type AutoPage, type AutoProgress, type AutoRun } from '../../src/core/automation';
import type { EventPreferences, VisibleOption } from '../../src/core/models';

const now = Date.parse('2026-10-18T05:00:00Z');
const p: EventPreferences = { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo?calendarId=HN', saleStartAt: new Date(now).toISOString(), quantity: 1, preferredZoneLabels: ['VIP', 'Khu A'], allowAlternatives: false };
const vip: VisibleOption = { id: 'vip', label: 'VIP', kind: 'ZONE', displayedPriceVnd: 1200000, displayedAvailability: 'AVAILABLE' };
function run(progress: Partial<AutoProgress> = {}): AutoRun {
  return { id: 'run', tabId: 1, revision: 0, preferencesKey: preferencesKey(p), startedAt: now - 20000, expiresAt: now + 3600000, progress: { phase: 'READY', message: '', ...progress } };
}
function page(patch: Partial<AutoPage> = {}): AutoPage {
  return { snapshot: { url: p.eventUrl, state: 'SELECTING', selectionMode: 'ZONE_ONLY', supported: true, reason: '', visibleOptions: [vip], maxQuantity: 2 }, enterCount: 0, advanceCount: 1, selectable: ['vip'], quantity: { value: 1, min: 1, max: 2, writable: true, stepper: false }, ...patch };
}
describe('máy trạng thái camp dùng chung', () => {
  it('modal đã xác minh đúng lựa chọn được tiếp tục; selected thông thường vẫn chặn', () => {
    const quoted = { ...p, catalog: { eventId: 'test', performanceId: 'HN', title: 'Demo', venue: 'HN', startsAt: '2030-01-01T00:00:00Z', verifiedAt: 1,
      tickets: [{ id: 'vip', name: 'VIP', priceVnd: 1200000 }] } };
    const session = { ...run(), preferencesKey: preferencesKey(quoted) };
    const view = page(); view.snapshot.visibleOptions = [{ ...vip, selected: true }];
    expect(decideAutomation(session, view, quoted, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    view.resumeSelection = vip.id;
    expect(decideAutomation(session, view, quoted, now)).toMatchObject({ type: 'STEP', progress: { phase: 'QUANTITY', chosen: { label: 'VIP' } } });
    view.snapshot.visibleOptions[0]!.displayedPriceVnd = 1300000;
    expect(decideAutomation(session, view, quoted, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
  it('chỉ chờ xác minh tự hoàn tất khi adapter xác nhận được modal hợp lệ', () => {
    const view = page(); view.snapshot.state = 'CHALLENGE';
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    view.verificationPending = true;
    expect(decideAutomation(run({ phase: 'CHOOSING', actionAt: now - 20000 }), view, p, now)).toMatchObject({ type: 'WAIT' });
    view.problem = 'Hạng không khớp';
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
  it('camp ngay bỏ lịch cũ trong tương lai, nhưng không reload trang còn khóa', () => {
    const immediate = { ...p, startMode: 'IMMEDIATE' as const, saleStartAt: '2030-01-01T00:00:00Z', refreshAtSale: true };
    const session = { ...run(), preferencesKey: preferencesKey(immediate) };
    expect(decideAutomation(session, page(), immediate, now)).toMatchObject({ type: 'STEP', action: { kind: 'CHOOSE' } });
    const closed = page(); closed.snapshot.state = 'NOT_READY';
    expect(decideAutomation(session, closed, immediate, now)).toMatchObject({ type: 'WAIT' });
  });
  it.each(['CHOOSING', 'QUANTITY', 'SETTING_QUANTITY'] as const)('nhiều khu cùng class được đánh dấu selected ở %s: dừng trước số lượng/checkout', phase => {
    const view = page();
    view.snapshot.visibleOptions = [1, 2].map(index => ({ ...vip, id: `zone-${index}`, zoneLabel: `VIP ${index}`, selected: true }));
    const decision = decideAutomation(run({ phase, chosen: vip, quantityAfterAction: 1 }), view, p, now);
    expect(decision).toMatchObject({ type: 'STEP', progress: { phase: 'PAUSED' } });
    expect(decision).not.toHaveProperty('action');
  });
  it('đã bấm mua → queue lâu → trang sự kiện: cho phép vào mua sau khi được cấp lượt', () => {
    const queued = page(); queued.snapshot.state = 'WAITING_ROOM';
    const waiting = decideAutomation(run({ phase: 'OPENING', actionAt: now - 60000 }), queued, p, now);
    expect(waiting).toMatchObject({ type: 'STEP', progress: { phase: 'READY' } });
    if (waiting.type !== 'STEP') throw new Error('Expected queued entry transition');
    const admitted = page(); admitted.snapshot.state = 'EVENT_PAGE'; admitted.enterCount = 1;
    expect(decideAutomation({ ...run(), progress: waiting.progress }, admitted, p, now)).toMatchObject({ type: 'STEP', action: { kind: 'ENTER' } });
  });
  it('queue sau khi gửi bước đi checkout không được reset để đặt lại vé', () => {
    const queued = page(); queued.snapshot.state = 'WAITING_ROOM';
    expect(decideAutomation(run({ phase: 'ADVANCING', actionAt: now - 60000 }), queued, p, now).type).toBe('WAIT');
  });
  it('chỉ tải lại một lần tại giờ bán khi vẫn khóa; không reload queue hoặc selection', () => {
    const configured = { ...p, refreshAtSale: true };
    const initial = { ...run(), preferencesKey: preferencesKey(configured) };
    const view = page(); view.snapshot.state = 'NOT_READY';
    expect(decideAutomation(initial, view, configured, now - 1)).toMatchObject({ type: 'WAIT', wakeAt: now });
    const reload = decideAutomation(initial, view, configured, now);
    expect(reload).toMatchObject({ action: { kind: 'RELOAD' }, progress: { releaseReloadedAt: now } });
    if (reload.type !== 'STEP') throw new Error('Expected reload');
    expect(decideAutomation({ ...initial, progress: reload.progress }, view, configured, now + 10).type).toBe('WAIT');
    view.snapshot.state = 'WAITING_ROOM'; expect(decideAutomation(initial, view, configured, now).type).toBe('WAIT');
    view.snapshot.state = 'SELECTING'; expect(decideAutomation(initial, view, configured, now)).toMatchObject({ action: { kind: 'CHOOSE' } });
    view.snapshot.state = 'NOT_READY'; expect(decideAutomation(initial, view, configured, now + 15000).type).toBe('WAIT');
  });
  it('chọn → xác nhận → số lượng → checkout; không bấm lại khi chờ', () => {
    const first = decideAutomation(run(), page(), p, now);
    expect(first).toMatchObject({ type: 'STEP', action: { kind: 'CHOOSE', optionId: 'vip' }, progress: { phase: 'CHOOSING' } });
    if (first.type !== 'STEP') throw new Error('Expected step');
    const choosing = run(first.progress);
    expect(decideAutomation(choosing, page(), p, now + 1).type).toBe('WAIT');
    const selected = page(); selected.snapshot.visibleOptions = [{ ...vip, selected: true }];
    const confirmed = decideAutomation(choosing, selected, p, now + 10);
    expect(confirmed).toMatchObject({ progress: { phase: 'QUANTITY' } });
    expect(decideAutomation(run({ ...first.progress, phase: 'QUANTITY' }), selected, p, now + 20)).toMatchObject({ action: { kind: 'ADVANCE' }, progress: { phase: 'ADVANCING' } });
    expect(decideAutomation(run({ phase: 'ADVANCING', actionAt: now }), selected, p, now + 100).type).toBe('WAIT');
    selected.snapshot.state = 'CHECKOUT'; selected.snapshot.url = 'https://ticket.1zone.vn/checkout/order';
    const done = decideAutomation(run({ phase: 'ADVANCING' }), selected, p, now + 200);
    expect(done).toMatchObject({ progress: { phase: 'CHECKOUT', checkoutReachedAt: now + 200 } });
    expect(done).not.toHaveProperty('action');
  });
  it('chỉ vào mua khi đúng giờ, đúng event và có một nút duy nhất', () => {
    const event = page(); event.snapshot.state = 'EVENT_PAGE'; event.enterCount = 1;
    expect(decideAutomation(run(), event, p, now - 1)).toMatchObject({ type: 'WAIT', wakeAt: now });
    expect(decideAutomation(run(), event, p, now)).toMatchObject({ action: { kind: 'ENTER' } });
    event.enterCount = 2;
    expect(decideAutomation(run(), event, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    event.snapshot.url = p.eventUrl.replace('=HN', '=HCM');
    expect(decideAutomation(run(), event, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
  it('fallback theo ưu tiên khi zone đầu hết vé', () => {
    const view = page(); view.snapshot.visibleOptions = [{ ...vip, displayedAvailability: 'UNAVAILABLE' }, { ...vip, id: 'a', label: 'Khu A' }]; view.selectable.push('a');
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ action: { kind: 'CHOOSE', optionId: 'a' } });
  });
  it('cập nhật số lượng từng bước với stepper và chờ xác nhận', () => {
    const two = { ...p, quantity: 2 };
    const current = { ...run({ phase: 'QUANTITY', chosen: vip }), preferencesKey: preferencesKey(two) };
    const view = page(); view.snapshot.visibleOptions = [{ ...vip, selected: true }]; view.quantity!.stepper = true;
    expect(decideAutomation(current, view, two, now)).toMatchObject({ action: { kind: 'QUANTITY', value: 2 }, progress: { phase: 'SETTING_QUANTITY', quantityAfterAction: 2 } });
  });
  it.each(['WAITING_ROOM', 'NOT_READY'] as const)('chờ %s, không gửi thao tác', state => {
    const view = page(); view.snapshot.state = state;
    expect(decideAutomation(run(), view, p, now).type).toBe('WAIT');
  });
  it.each(['CHALLENGE', 'UNKNOWN'] as const)('dừng trước %s', state => {
    const view = page(); view.snapshot.state = state; view.snapshot.supported = false;
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
  it('không bấm lại sau timeout, đổi cấu hình, hết phiên hoặc giỏ có vé sẵn', () => {
    expect(decideAutomation(run({ phase: 'ADVANCING', actionAt: now - 15000 }), page(), p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    expect(decideAutomation(run(), page(), { ...p, quantity: 2 }, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    expect(decideAutomation({ ...run(), expiresAt: now }, page(), p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    const view = page(); view.snapshot.visibleOptions = [{ ...vip, selected: true }];
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
  it('không gộp ghế đơn thành nhiều vé hoặc chọn zone mơ hồ trong luồng chọn ghế', () => {
    const view = page(); view.snapshot.selectionMode = 'PICK_SEAT';
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    view.snapshot.visibleOptions = [{ ...vip, kind: 'SEAT' }];
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ action: { kind: 'CHOOSE' } });
    const two = { ...p, quantity: 2 };
    expect(decideAutomation({ ...run(), preferencesKey: preferencesKey(two) }, view, two, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
  it('không click khi lỗi giữ chỗ, thiếu số lượng, nhiều nút tiếp hoặc vượt ngân sách', () => {
    expect(decideAutomation(run(), page({ problem: 'Hết thời gian giữ chỗ' }), p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    const view = page({ quantity: undefined }); view.snapshot.visibleOptions = [{ ...vip, selected: true }];
    expect(decideAutomation(run({ phase: 'QUANTITY', chosen: vip }), view, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    const budget = { ...p, maxTotalVnd: 500000 };
    expect(decideAutomation({ ...run(), preferencesKey: preferencesKey(budget) }, page(), budget, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
});
