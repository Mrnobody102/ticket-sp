import { describe, expect, it } from 'vitest';
import { seatPlans } from '../../src/platforms/onezone-seat-plans';
import { decideAutomation, isAutoProgress, preferencesKey, sameOption, type AutoPage, type AutoRun } from '../../src/core/automation';
import type { EventPreferences, VisibleOption } from '../../src/core/models';

const row = (rowName: string, codes = [1, 2, 3, 4, 5, 6], zoneId = 'summer') => codes.map(code => ({ id: `${zoneId}-${rowName}-${code}`, ticketClassId: 'summer', zoneId, zoneName: 'SUMMER', rowName, code: String(code) }));
describe('lập nhóm ghế', () => {
  it('ưu tiên hàng trước, cặp ở giữa, cùng khu; không dựa vào tọa độ/màu', () => {
    const plans = seatPlans([...row('B'), ...row('A')].reverse(), 2);
    expect(plans[0]?.map(s => `${s.rowName}-${s.code}`)).toEqual(['A-3', 'A-4']);
    expect(plans.every(p => new Set(p.map(s => s.zoneId)).size === 1 && new Set(p.map(s => s.rowName)).size === 1)).toBe(true);
  });
  it('không ghép qua lối đi đánh số hoặc qua hai zone', () => {
    const plans = seatPlans([...row('A', [1, 2], 'left'), ...row('A', [3, 4], 'right')], 2);
    expect(plans).toHaveLength(2);
    expect(plans.every(p => new Set(p.map(s => s.zoneId)).size === 1)).toBe(true);
  });
  it('ưu tiên cặp liền nhau trước cặp số có khoảng hở', () => {
    expect(seatPlans(row('A', [1, 3, 4, 6]), 2)[0]?.map(s => s.code)).toEqual(['3', '4']);
  });
  it.each([0, 11, 1.2, -1])('từ chối số lượng không hỗ trợ %s', quantity => expect(seatPlans(row('A'), quantity)).toEqual([]));
  it('số ghế sắp xếp tự nhiên, 10 sau 9', () => {
    const plans = seatPlans(row('A', [2, 9, 10, 12]), 2);
    expect(plans[0]?.map(s => s.code)).toEqual(['9', '10']);
  });
});

const p: EventPreferences = { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo?calendarId=HN', saleStartAt: new Date(0).toISOString(), quantity: 2, preferredZoneLabels: ['SUMMER'], allowAlternatives: false };
const chosen: VisibleOption = { id: 'group', kind: 'ZONE', label: 'SUMMER', zoneLabel: 'SUMMER', ticketTypeId: 'summer', displayedPriceVnd: 1690000, displayedAvailability: 'AVAILABLE', seatLabels: ['SUMMER-A-3', 'SUMMER-A-4'] };
const run = (): AutoRun => ({ id: 's', revision: 1, tabId: 1, startedAt: 1, expiresAt: 100000, preferencesKey: preferencesKey(p), progress: { phase: 'ADVANCING', chosen, actionAt: 1, reservationAttemptedAt: 1, message: '' } });
const page = (): AutoPage => ({ snapshot: { url: p.eventUrl, state: 'CHALLENGE', supported: false, selectionMode: 'PICK_SEAT', visibleOptions: [], reason: '' }, verificationPending: true, selectable: [], enterCount: 0, advanceCount: 0 });
describe('phiên chọn nhóm ghế', () => {
  it('không đồng nhất hai nhóm ghế cùng hạng, giá và zone', () => {
    expect(sameOption(chosen, { ...chosen, seatLabels: ['SUMMER-A-4', 'SUMMER-A-3'] })).toBe(true);
    expect(sameOption(chosen, { ...chosen, seatLabels: ['SUMMER-A-5', 'SUMMER-A-6'] })).toBe(false);
    expect(sameOption(chosen, { ...chosen, seatLabels: undefined })).toBe(false);
  });
  it('không timeout giữ vé trong xác minh và không gửi lại khi widget biến mất', () => {
    const session = run(), view = page();
    const verify = decideAutomation(session, view, p, 20000);
    expect(verify).toMatchObject({ type: 'STEP', progress: { verificationStartedAt: 20000, phase: 'ADVANCING' } });
    if (verify.type !== 'STEP') throw new Error('Expected verification wait');
    session.progress = verify.progress;
    expect(decideAutomation(session, view, p, 50000)).toMatchObject({ type: 'WAIT' });
    view.snapshot.state = 'SELECTING';
    const continueWaiting = decideAutomation(session, view, p, 50000);
    expect(continueWaiting).toMatchObject({ type: 'STEP', progress: { phase: 'ADVANCING', actionAt: 50000 } });
    expect(continueWaiting).not.toHaveProperty('action');
  });
  it('không nhận danh sách ghế trùng hoặc clock sai từ storage', () => {
    expect(isAutoProgress(run().progress)).toBe(true);
    expect(isAutoProgress({ ...run().progress, chosen: { ...chosen, seatLabels: ['A1', 'A1'] } })).toBe(false);
    expect(isAutoProgress({ ...run().progress, verificationStartedAt: 'bad' })).toBe(false);
  });
});
