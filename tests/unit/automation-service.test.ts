import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_KEY, ensureNoUnresolvedReservation, handleAutoCommand, reconcileAutoRun, replaceAutoRunTab } from '../../src/infrastructure/automation-service';
import { CONFIG_KEY } from '../../src/infrastructure/storage';
import type { TaskConfig } from '../../src/core/models';
import type { AutoRun } from '../../src/core/automation';

const prefs: TaskConfig['preferences'] = { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo', saleStartAt: new Date(0).toISOString(), quantity: 1, preferredZoneLabels: [], allowAlternatives: false };
const sender = { id: 'ext', frameId: 0, url: prefs.eventUrl, tab: { id: 1, url: prefs.eventUrl } } as chrome.runtime.MessageSender;
let local: Record<string, unknown>;
let session: Record<string, unknown>;
beforeEach(() => {
  local = { [CONFIG_KEY]: { schemaVersion: 1, preferences: prefs, enabled: true, panelVisible: true } }; session = {};
  const area = (store: Record<string, unknown>) => ({
    get: async (key: string) => ({ [key]: store[key] }),
    set: async (value: object) => { Object.assign(store, value); },
    remove: async (key: string) => { delete store[key]; },
  });
  vi.stubGlobal('chrome', { storage: { local: area(local), session: area(session) }, tabs: { get: vi.fn(async () => ({ id: 2, url: prefs.eventUrl })), sendMessage: vi.fn(async () => undefined), update: vi.fn(async () => ({ windowId: 1 })) }, windows: { update: vi.fn(async () => undefined) }, runtime: { getURL: (path: string) => `chrome-extension://ext${path}` } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('khóa phiên và CAS tại background', () => {
  it('Chrome thay tab ID: chuyển đúng chủ, giữ dấu giữ vé và từ chối chủ cũ', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    run.progress = { phase: 'ADVANCING', message: '', reservationAttemptedAt: 123 };
    session[AUTO_KEY] = run;
    await replaceAutoRunTab(2, 99); expect(session[AUTO_KEY]).toBe(run);
    await replaceAutoRunTab(2, 1);
    expect(session[AUTO_KEY]).toMatchObject({ id: run.id, tabId: 2, revision: 1, progress: { phase: 'ADVANCING', reservationAttemptedAt: 123 } });
    await expect(handleAutoCommand({ type: 'AUTO_STEP', id: run.id, revision: 0, progress: run.progress }, sender)).rejects.toThrow('đã đổi');
  });
  it('tab thay thế sai sự kiện: không tự chạy mua ở trang khác', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 2, url: 'https://ticket.1zone.vn/events/other' } as chrome.tabs.Tab);
    await replaceAutoRunTab(2, 1);
    expect(session[AUTO_KEY]).toMatchObject({ id: run.id, tabId: 2, progress: { phase: 'PAUSED' } });
  });
  it('watchdog hết hạn khi content không chạy: ghi tạm dừng nhưng không xóa dấu giữ vé', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    run.expiresAt = Date.now() - 1;
    run.progress = { phase: 'ADVANCING', message: '', reservationAttemptedAt: 123 };
    session[AUTO_KEY] = run;
    await reconcileAutoRun();
    expect(session[AUTO_KEY]).toMatchObject({ id: run.id, revision: run.revision + 1, progress: { phase: 'PAUSED', reservationAttemptedAt: 123 } });
  });
  it('giữ vé chưa rõ kết quả: không bắt đầu hoặc lưu cấu hình mới, vẫn mở đúng tab cũ', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    run.progress = { phase: 'PAUSED', message: '', reservationAttemptedAt: Date.now() };
    session[AUTO_KEY] = run;
    await expect(handleAutoCommand({ type: 'AUTO_START' }, sender)).rejects.toThrow('chưa rõ kết quả');
    await expect(handleAutoCommand({ type: 'AUTO_START_HERE' }, { ...sender, tab: { ...sender.tab!, id: 2 } })).rejects.toThrow('chưa rõ kết quả');
    await expect(ensureNoUnresolvedReservation()).rejects.toThrow('chưa rõ kết quả');
    await handleAutoCommand({ type: 'AUTO_FOCUS' }, { ...sender, url: 'chrome-extension://ext/popup.html' });
    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
    run.progress.phase = 'CHECKOUT';
    await expect(ensureNoUnresolvedReservation()).resolves.toBeUndefined();
  });
  it('không thể bỏ dấu giữ vé bằng một AUTO_STEP khác', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    run.progress = { phase: 'ADVANCING', message: '', reservationAttemptedAt: 123 };
    session[AUTO_KEY] = run;
    await expect(handleAutoCommand({ type: 'AUTO_STEP', id: run.id, revision: 0, progress: { phase: 'PAUSED', message: '' } }, sender)).rejects.toThrow('dấu yêu cầu');
    await expect(handleAutoCommand({ type: 'AUTO_STEP', id: run.id, revision: 0, progress: { ...run.progress, phase: 'PAUSED' } }, sender)).resolves.toMatchObject({ progress: { reservationAttemptedAt: 123 } });
  });
  it('mở đúng tab đang camp không điều hướng lại URL; chỉ trang tiện ích được yêu cầu', async () => {
    await handleAutoCommand({ type: 'AUTO_START' }, sender);
    await handleAutoCommand({ type: 'AUTO_FOCUS' }, { ...sender, url: 'chrome-extension://ext/popup.html' });
    expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(1, { active: true });
    await expect(handleAutoCommand({ type: 'AUTO_FOCUS' }, sender)).rejects.toThrow('tab camp');
  });
  it('bấm camp tại tab mới: chuyển phiên chưa chọn vé, vô hiệu lệnh của tab cũ', async () => {
    const original = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    const other = { ...sender, tab: { ...sender.tab!, id: 2 } };
    const next = (await handleAutoCommand({ type: 'AUTO_START_HERE' }, other))!;
    expect(next.tabId).toBe(2); expect(next.id).not.toBe(original.id);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'AUTO_UPDATED', run: null });
    await expect(handleAutoCommand({ type: 'AUTO_STEP', id: original.id, revision: 0, progress: { phase: 'OPENING', message: '' } }, sender)).rejects.toThrow('đã đổi');
  });
  it('phòng chờ đúng đích được nhận làm tab camp; sai đích bị từ chối', async () => {
    const url = 'https://queue.1zone.vn/?t=' + encodeURIComponent(prefs.eventUrl.replace('/events/', '/booking/'));
    const queued = { ...sender, url, tab: { id: 2, url } } as chrome.runtime.MessageSender;
    expect((await handleAutoCommand({ type: 'AUTO_START_HERE' }, queued))?.tabId).toBe(2);
    const wrong = { ...queued, tab: { id: 3, url: url.replace('demo', 'other') } } as chrome.runtime.MessageSender;
    await expect(handleAutoCommand({ type: 'AUTO_START_HERE' }, wrong)).rejects.toThrow('đúng tab');
  });
  it('không chuyển tab khi đã chọn hoặc đang gửi giữ vé', async () => {
    await handleAutoCommand({ type: 'AUTO_START' }, sender);
    const run = session[AUTO_KEY] as AutoRun; run.progress = { phase: 'CHOOSING', message: '', chosen: { label: 'VIP', kind: 'ZONE' } };
    await expect(handleAutoCommand({ type: 'AUTO_START_HERE' }, { ...sender, tab: { ...sender.tab!, id: 2 } })).rejects.toThrow('giữ vé');
    expect((session[AUTO_KEY] as AutoRun).tabId).toBe(1);
  });
  it('bật trước giờ bán một ngày: hết phiên một giờ sau giờ bán, không sau lúc bật', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T05:00:00Z'));
    const config = local[CONFIG_KEY] as TaskConfig;
    config.preferences = { ...prefs, saleStartAt: '2026-10-19T05:00:00Z' };
    const run = await handleAutoCommand({ type: 'AUTO_START' }, sender);
    expect(run?.expiresAt).toBe(Date.parse('2026-10-19T06:00:00Z'));
  });
  it('một tab sở hữu; tab khác không lấy hoặc ghi đè phiên', async () => {
    const run = await handleAutoCommand({ type: 'AUTO_START' }, sender);
    expect(run?.tabId).toBe(1);
    const other = { ...sender, tab: { ...sender.tab!, id: 2 } };
    await expect(handleAutoCommand({ type: 'AUTO_START' }, other)).rejects.toThrow('một tab');
    expect(await handleAutoCommand({ type: 'AUTO_GET' }, other)).toBeNull();
    await expect(handleAutoCommand({ type: 'AUTO_STOP' }, other)).rejects.toThrow();
  });
  it('ghi tăng revision trước hành động; từ chối cùng bước được gửi lại', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    const step = { type: 'AUTO_STEP' as const, id: run.id, revision: 0, progress: { phase: 'OPENING' as const, message: 'Mở mua vé', actionAt: Date.now() } };
    const next = await handleAutoCommand(step, sender);
    expect(next?.revision).toBe(1); expect((session[AUTO_KEY] as AutoRun).progress.phase).toBe('OPENING');
    await expect(handleAutoCommand(step, sender)).rejects.toThrow('đã đổi');
  });
  it('dừng phiên hủy bước còn chờ; từ chối chạy trong iframe', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    await handleAutoCommand({ type: 'AUTO_STOP' }, sender);
    expect(session[AUTO_KEY]).toBeUndefined();
    await expect(handleAutoCommand({ type: 'AUTO_STEP', id: run.id, revision: 0, progress: { phase: 'CHOOSING', message: '' } }, sender)).rejects.toThrow();
    await expect(handleAutoCommand({ type: 'AUTO_START' }, { ...sender, frameId: 3 })).rejects.toThrow('tab chính');
  });
  it('đổi cấu hình làm bước cũ mất hiệu lực', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    const config = local[CONFIG_KEY] as TaskConfig;
    config.preferences = { ...prefs, quantity: 2 };
    await expect(handleAutoCommand({ type: 'AUTO_STEP', id: run.id, revision: 0, progress: { phase: 'CHOOSING', message: '' } }, sender)).rejects.toThrow('Cấu hình');
  });
  it('từ chối dữ liệu progress hỏng và nhảy bước không hợp lệ', async () => {
    const run = (await handleAutoCommand({ type: 'AUTO_START' }, sender))!;
    await expect(handleAutoCommand({ type: 'AUTO_STEP', id: run.id, revision: 0, progress: { phase: 'ADVANCING', message: '' } }, sender)).rejects.toThrow('chuyển bước');
    await expect(handleAutoCommand({ type: 'AUTO_STEP', id: run.id, revision: 0, progress: { phase: 'CHOOSING', message: '', actionAt: NaN } }, sender)).rejects.toThrow('Trạng thái');
    session[AUTO_KEY] = { progress: { phase: 'BROKEN' } };
    expect(await handleAutoCommand({ type: 'AUTO_GET' }, sender)).toBeNull();
  });
});
