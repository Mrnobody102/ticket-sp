import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMP_GUARD_ALARM, CAMP_GUARD_KEY, reconcileCampGuard } from '../../src/infrastructure/camp-guard';
import { preferencesKey, type AutoRun } from '../../src/core/automation';
import type { EventPreferences } from '../../src/core/models';

const now = Date.parse('2026-10-22T04:00:00Z');
const p: EventPreferences = { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo', saleStartAt: new Date(now + 180000).toISOString(),
  quantity: 1, preferredZoneLabels: [], allowAlternatives: false };
const run = (): AutoRun => ({ id: 'run', tabId: 1, revision: 0, preferencesKey: preferencesKey(p), startedAt: now,
  expiresAt: now + 3600000, progress: { phase: 'READY', message: '' } });
let storage: Record<string, unknown>, alarms: Record<string, unknown>, tabs: Record<number, Partial<chrome.tabs.Tab>>;
beforeEach(() => {
  storage = {}; alarms = {}; tabs = { 1: { id: 1, windowId: 2, autoDiscardable: true, discarded: false } };
  vi.stubGlobal('chrome', {
    power: { requestKeepAwake: vi.fn(), releaseKeepAwake: vi.fn() },
    storage: { session: { get: async (key: string) => ({ [key]: storage[key] }), set: async (value: object) => { Object.assign(storage, value); }, remove: async (key: string) => { delete storage[key]; } } },
    alarms: { get: vi.fn(async (key: string) => alarms[key]), create: vi.fn(async (key: string, value: object) => { alarms[key] = value; }), clear: vi.fn(async (key: string) => { delete alarms[key]; return true; }) },
    tabs: { get: vi.fn(async (id: number) => tabs[id]), update: vi.fn(async (id: number, value: object) => { Object.assign(tabs[id]!, value); return tabs[id]; }), sendMessage: vi.fn(async () => undefined), reload: vi.fn() },
    windows: { update: vi.fn(async () => undefined) },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('bảo vệ phiên camp ngoài đường chọn vé', () => {
  it('Dừng hoặc chuyển chủ trong lúc guard chờ Chrome: không gửi lại phiên cũ', async () => {
    const current = run();
    await reconcileCampGuard(current, p, now, async () => null);
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    await reconcileCampGuard(current, p, now, async () => ({ ...current, id: 'new-run' }));
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
  it('bật trước giờ bán: giữ máy thức và tab, không đợi tới mốc bán mới bảo vệ', async () => {
    const current = run(); await reconcileCampGuard(current, p, now);
    expect(chrome.power.requestKeepAwake).toHaveBeenCalledWith('system');
    expect(tabs[1]!.autoDiscardable).toBe(false);
    expect(storage[CAMP_GUARD_KEY]).toMatchObject({ runId: current.id, autoDiscardable: true, focused: false });
    expect(alarms[CAMP_GUARD_ALARM]).toEqual({ when: now + 30000, periodInMinutes: 0.5 });
    expect(chrome.windows.update).not.toHaveBeenCalled(); expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });
  it('đưa tab ra trước ở giai đoạn chuẩn bị, chỉ một lần qua nhiều lượt hoặc worker mới', async () => {
    const current = run(); await reconcileCampGuard(current, p, now);
    await reconcileCampGuard(current, p, now + 60000);
    await reconcileCampGuard(current, p, now + 60001);
    expect(chrome.windows.update).toHaveBeenCalledExactlyOnceWith(2, { focused: true });
    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
    expect(chrome.alarms.create).toHaveBeenCalledOnce();
  });
  it('camp ngay đưa tab ra trước ngay; không sửa URL phòng chờ hoặc giỏ', async () => {
    const prefs = { ...p, startMode: 'IMMEDIATE' as const };
    await reconcileCampGuard({ ...run(), preferencesKey: preferencesKey(prefs) }, prefs, now);
    expect(chrome.windows.update).toHaveBeenCalledOnce();
    for (const [, value] of vi.mocked(chrome.tabs.update).mock.calls) expect(value).not.toHaveProperty('url');
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });
  it('tab bị discard: kích hoạt đúng tab để Chrome khôi phục, vẫn gửi cùng phiên', async () => {
    const current = run(); await reconcileCampGuard(current, p, now + 60000);
    tabs[1]!.discarded = true;
    await reconcileCampGuard(current, p, now + 60001);
    expect(chrome.tabs.update).toHaveBeenLastCalledWith(1, { active: true });
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(1, { type: 'AUTO_UPDATED', run: current });
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });
  it.each(['CHECKOUT', 'PAUSED'] as const)('%s: trả lại chính sách tab, thả chống ngủ và hủy alarm', async phase => {
    const current = run(); await reconcileCampGuard(current, p, now);
    await reconcileCampGuard({ ...current, progress: { phase, message: '' } }, p, now);
    expect(tabs[1]!.autoDiscardable).toBe(true); expect(chrome.power.releaseKeepAwake).toHaveBeenCalled();
    expect(storage[CAMP_GUARD_KEY]).toBeUndefined(); expect(alarms[CAMP_GUARD_ALARM]).toBeUndefined();
  });
  it('tab vốn không cho discard vẫn giữ nguyên chính sách sau Dừng', async () => {
    tabs[1]!.autoDiscardable = false;
    await reconcileCampGuard(run(), p, now); await reconcileCampGuard(null, p, now);
    expect(tabs[1]!.autoDiscardable).toBe(false);
  });
  it('chuyển tab: trả tab cũ, bảo vệ chủ mới và không tạo lại alarm mỗi bước', async () => {
    const current = run(); await reconcileCampGuard(current, p, now);
    tabs[3] = { id: 3, windowId: 4, autoDiscardable: true };
    await reconcileCampGuard({ ...current, id: 'transferred', tabId: 3 }, p, now);
    expect(tabs[1]!.autoDiscardable).toBe(true); expect(tabs[3]!.autoDiscardable).toBe(false);
    expect(storage[CAMP_GUARD_KEY]).toMatchObject({ runId: 'transferred', tabId: 3 });
  });
  it('hết hạn hoặc cấu hình không khớp: không giữ máy thức vô hạn', async () => {
    const current = run(); await reconcileCampGuard(current, p, now);
    await reconcileCampGuard(current, p, current.expiresAt);
    expect(storage[CAMP_GUARD_KEY]).toBeUndefined();
    await reconcileCampGuard(current, { ...p, quantity: 2 }, now);
    expect(storage[CAMP_GUARD_KEY]).toBeUndefined();
  });
  it('Chrome thay tab ID và kế thừa cờ tạm: vẫn khôi phục chính sách ban đầu khi Dừng', async () => {
    const current = run(); await reconcileCampGuard(current, p, now);
    tabs[3] = { id: 3, windowId: 2, autoDiscardable: false, discarded: true };
    await reconcileCampGuard({ ...current, tabId: 3 }, p, now);
    await reconcileCampGuard(null, p, now);
    expect(tabs[3]!.autoDiscardable).toBe(true);
  });
});
