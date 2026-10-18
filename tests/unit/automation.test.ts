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
  it('chế độ theo web: nút mua đã xác minh mở sớm thì vào ngay; nhãn chung không đủ', () => {
    const configured = { ...p, startMode: 'WHEN_AVAILABLE' as const, saleStartAt: new Date(now + 120000).toISOString() };
    const session = { ...run(), preferencesKey: preferencesKey(configured) };
    const view = page({ enterCount: 1 }); view.snapshot.state = 'EVENT_PAGE';
    expect(decideAutomation(session, view, configured, now)).toMatchObject({ type: 'WAIT' });
    view.saleOpen = true;
    expect(decideAutomation(session, view, configured, now)).toMatchObject({ action: { kind: 'ENTER' } });
    view.snapshot.state = 'SELECTING';
    expect(decideAutomation(session, view, configured, now)).toMatchObject({ action: { kind: 'CHOOSE' } });
    const strict = { ...configured, startMode: undefined };
    expect(decideAutomation({ ...session, preferencesKey: preferencesKey(strict) }, view, strict, now)).toMatchObject({ type: 'WAIT' });
  });
  it('kiểm tra trang còn khóa từ hai phút trước giờ bán; sau click không bị chặn lại bởi giờ', () => {
    const configured = { ...p, startMode: 'WHEN_AVAILABLE' as const, saleStartAt: new Date(now + 180000).toISOString(), refreshAtSale: true };
    const session = { ...run(), preferencesKey: preferencesKey(configured) };
    const view = page(); view.snapshot.state = 'NOT_READY';
    expect(decideAutomation(session, view, configured, now)).toMatchObject({ type: 'WAIT', wakeAt: now + 60000 });
    const refresh = decideAutomation(session, view, configured, now + 60000);
    expect(refresh).toMatchObject({ action: { kind: 'RELOAD' } });
    if (refresh.type !== 'STEP') throw new Error('Expected refresh');
    expect(decideAutomation({ ...session, progress: refresh.progress }, view, configured, now + 60100)).toMatchObject({ type: 'WAIT', wakeAt: now + 62500 });
    view.snapshot.state = 'SELECTING';
    expect(decideAutomation({ ...session, progress: { phase: 'OPENING', message: '', actionAt: now } }, view, configured, now + 1000)).toMatchObject({ progress: { phase: 'READY' } });
  });
  it('phút cuối kiểm tra mỗi giây; không F5 cắt ngang trang đang tải', () => {
    const configured = { ...p, startMode: 'WHEN_AVAILABLE' as const, refreshAtSale: true };
    const session = { ...run({ lastReleaseReloadAt: now - 45000 }), preferencesKey: preferencesKey(configured) };
    const view = page(); view.snapshot.state = 'NOT_READY';
    expect(decideAutomation(session, view, configured, now - 44001)).toMatchObject({ type: 'WAIT', wakeAt: now - 44000 });
    expect(decideAutomation(session, view, configured, now - 44000)).toMatchObject({ action: { kind: 'RELOAD' } });
    view.loading = true; view.documentStartedAt = now - 2000;
    expect(decideAutomation(session, view, configured, now)).toMatchObject({ type: 'WAIT', wakeAt: now + 250 });
    expect(decideAutomation(session, view, configured, now + 20000)).toMatchObject({ action: { kind: 'RELOAD' } });
    view.loading = false;
    expect(decideAutomation(session, view, configured, now)).toMatchObject({ action: { kind: 'RELOAD' } });
  });
  it('hạng ưu tiên hết nhưng hạng khác còn: chờ vé trả lại, không mua sai hoặc dừng', () => {
    const view = page();
    view.snapshot.visibleOptions = [{ ...vip, displayedAvailability: 'UNAVAILABLE' }, { ...vip, id: 'vvip', label: 'VVIP' }];
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ type: 'WAIT', wakeAt: now + 1000 });
    view.snapshot.visibleOptions[0]!.displayedAvailability = 'AVAILABLE';
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ action: { kind: 'CHOOSE', optionId: 'vip' } });
    const budget = { ...p, maxTotalVnd: 1000000 };
    view.snapshot.visibleOptions[0]!.displayedAvailability = 'UNAVAILABLE';
    expect(decideAutomation({ ...run(), preferencesKey: preferencesKey(budget) }, view, budget, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
  it('chỉ thử lại CTA điều hướng đã xác minh; giới hạn 3 lần và không lặp khi tới queue', () => {
    const view = page({ entryRetrySafe: true, enterCount: 1 }); view.snapshot.state = 'EVENT_PAGE';
    const current = run({ phase: 'OPENING', actionAt: now - 1500, entryAttempts: 1 });
    expect(decideAutomation(current, view, p, now)).toMatchObject({ action: { kind: 'ENTER' }, progress: { entryAttempts: 2 } });
    expect(decideAutomation({ ...current, progress: { ...current.progress, entryAttempts: 3 } }, view, p, now)).not.toHaveProperty('action');
    const refresh = { ...p, refreshAtSale: true };
    expect(decideAutomation({ ...current, preferencesKey: preferencesKey(refresh), progress: { ...current.progress, entryAttempts: 3 } }, view, refresh, now + 15000)).toMatchObject({ action: { kind: 'RELOAD' }, progress: { phase: 'READY' } });
    view.entryRetrySafe = false;
    expect(decideAutomation(current, view, p, now)).not.toHaveProperty('action');
    view.entryRetrySafe = true; view.snapshot.state = 'WAITING_ROOM';
    expect(decideAutomation(current, view, p, now)).toMatchObject({ progress: { phase: 'READY' } });
    view.snapshot.state = 'CHALLENGE'; view.verificationPending = true;
    expect(decideAutomation(current, view, p, now)).toMatchObject({ progress: { phase: 'READY' } });
  });
  it('khu hết vé trước khi gửi giữ chỗ: chỉ thử khu khác khi adapter xác nhận an toàn', () => {
    const current = run({ phase: 'CHOOSING', chosen: vip, actionAt: now });
    const view = page({ selectionRetrySafe: true }); view.snapshot.visibleOptions = [{ ...vip, displayedAvailability: 'UNAVAILABLE' }];
    expect(decideAutomation(current, view, p, now)).toMatchObject({ progress: { phase: 'READY', selectionRetries: 1 } });
    view.selectionRetrySafe = false;
    expect(decideAutomation(current, view, p, now)).toMatchObject({ type: 'WAIT' });
    view.selectionRetrySafe = true;
    expect(decideAutomation({ ...current, progress: { ...current.progress, selectionRetries: 5 } }, view, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
    expect(decideAutomation({ ...current, progress: { ...current.progress, phase: 'ADVANCING' } }, view, p, now)).toMatchObject({ type: 'WAIT' });
  });
  it('chỉ tiếp tục bước mua kèm đã xác minh một lần trong phiên đang chuyển checkout', () => {
    const view = page({ verifiedAddons: true }); view.snapshot.url = 'https://ticket.1zone.vn/checkout/add-ons?orderId=test'; view.snapshot.state = 'UNKNOWN';
    const decision = decideAutomation(run({ phase: 'ADVANCING', chosen: vip }), view, p, now);
    expect(decision).toMatchObject({ type: 'STEP', action: { kind: 'ADVANCE' }, progress: { addonsContinuedAt: now } });
    expect(decideAutomation(run({ phase: 'ADVANCING', chosen: vip, addonsContinuedAt: now }), view, p, now + 100)).toMatchObject({ type: 'WAIT' });
    expect(decideAutomation(run({ phase: 'ADVANCING', chosen: vip, addonsContinuedAt: now }), view, p, now + 16000)).toMatchObject({ progress: { phase: 'PAUSED' } });
    expect(decideAutomation(run(), view, p, now)).toMatchObject({ progress: { phase: 'PAUSED' } });
  });
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
  it('camp ngay bỏ lịch cũ; cập nhật trang còn khóa khi người dùng bật tùy chọn', () => {
    const immediate = { ...p, startMode: 'IMMEDIATE' as const, saleStartAt: '2030-01-01T00:00:00Z', refreshAtSale: true };
    const session = { ...run(), preferencesKey: preferencesKey(immediate) };
    expect(decideAutomation(session, page(), immediate, now)).toMatchObject({ type: 'STEP', action: { kind: 'CHOOSE' } });
    const closed = page(); closed.snapshot.state = 'NOT_READY';
    expect(decideAutomation(session, closed, immediate, now)).toMatchObject({ action: { kind: 'RELOAD' } });
    const passive = { ...immediate, refreshAtSale: false };
    expect(decideAutomation({ ...session, preferencesKey: preferencesKey(passive) }, closed, passive, now)).toMatchObject({ type: 'WAIT' });
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
  it('trang còn khóa sau giờ bán: thử cập nhật có giãn cách; không reload queue hoặc selection', () => {
    const configured = { ...p, refreshAtSale: true };
    const initial = { ...run(), preferencesKey: preferencesKey(configured) };
    const view = page(); view.snapshot.state = 'NOT_READY';
    expect(decideAutomation(initial, view, configured, now - 1)).toMatchObject({ type: 'WAIT', wakeAt: now });
    const reload = decideAutomation(initial, view, configured, now);
    expect(reload).toMatchObject({ action: { kind: 'RELOAD' }, progress: { releaseReloadedAt: now } });
    if (reload.type !== 'STEP') throw new Error('Expected reload');
    expect(decideAutomation({ ...initial, progress: reload.progress }, view, configured, now + 10).type).toBe('WAIT');
    expect(decideAutomation({ ...initial, progress: reload.progress }, view, configured, now + 999)).toMatchObject({ type: 'WAIT', wakeAt: now + 1000 });
    expect(decideAutomation({ ...initial, progress: reload.progress }, view, configured, now + 1000)).toMatchObject({ action: { kind: 'RELOAD' } });
    view.snapshot.state = 'WAITING_ROOM'; expect(decideAutomation(initial, view, configured, now).type).toBe('WAIT');
    view.snapshot.state = 'SELECTING'; expect(decideAutomation(initial, view, configured, now)).toMatchObject({ action: { kind: 'CHOOSE' } });
    view.snapshot.state = 'NOT_READY';
    expect(decideAutomation({ ...initial, progress: reload.progress }, view, configured, now + 2500)).toMatchObject({ action: { kind: 'RELOAD' }, progress: { releaseReloadedAt: now, lastReleaseReloadAt: now + 2500 } });
    expect(decideAutomation(initial, view, configured, now + 15000)).toMatchObject({ action: { kind: 'RELOAD' } });
    expect(decideAutomation({ ...initial, progress: { ...reload.progress, lastReleaseReloadAt: now + 30000 } }, view, configured, now + 31000)).toMatchObject({ type: 'WAIT', wakeAt: now + 35000 });
    view.snapshot.state = 'CHALLENGE'; expect(decideAutomation(initial, view, configured, now)).not.toHaveProperty('action');
    view.snapshot.state = 'CHECKOUT'; expect(decideAutomation(initial, view, configured, now)).not.toHaveProperty('action');
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
