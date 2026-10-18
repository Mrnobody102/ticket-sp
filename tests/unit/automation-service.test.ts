import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_KEY, handleAutoCommand } from '../../src/infrastructure/automation-service';
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
  vi.stubGlobal('chrome', { storage: { local: area(local), session: area(session) }, tabs: { sendMessage: vi.fn(async () => undefined) }, runtime: { getURL: (path: string) => `chrome-extension://ext${path}` } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('khóa phiên và CAS tại background', () => {
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
