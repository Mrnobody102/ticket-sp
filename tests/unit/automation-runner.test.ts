import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutomationRunner } from '../../src/application/automation-runner';
import { preferencesKey, type AutoRun } from '../../src/core/automation';
import type { TaskConfig } from '../../src/core/models';
import type { PlatformInspection } from '../../src/platforms/contracts';

afterEach(() => vi.useRealTimers());
describe('runner độc lập platform', () => {
  function controls() {
    const config: TaskConfig = { schemaVersion: 1, enabled: true, panelVisible: true, preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo', saleStartAt: new Date(0).toISOString(), quantity: 1, preferredZoneLabels: [], allowAlternatives: false } };
    const run: AutoRun = { id: 'control-test', tabId: 1, revision: 0, preferencesKey: preferencesKey(config.preferences!), startedAt: Date.now(), expiresAt: Date.now() + 3600000, progress: { phase: 'READY', message: '' } };
    let resolveStart!: (run: AutoRun) => void;
    const start = vi.fn(() => new Promise<AutoRun>(resolve => { resolveStart = resolve; }));
    const stop = vi.fn(async () => null);
    const runner = createAutomationRunner({ config: () => config, inspect: () => { throw new Error('No DOM action expected'); }, changed: vi.fn(), transport: { start, stop, commit: vi.fn() } });
    return { run, runner, start, stop, resolveStart: () => resolveStart(run) };
  }
  it('bấm bắt đầu hai lần chỉ gửi một yêu cầu và hiện trạng thái chờ', async () => {
    const { runner, start, resolveStart } = controls();
    const pending = runner.start(); await runner.start();
    expect(start).toHaveBeenCalledOnce(); expect(runner.pendingControl).toBe(true);
    resolveStart(); await pending;
    expect(runner.pendingControl).toBe(false); runner.destroy();
  });
  it('phản hồi START muộn không ghi đè AUTO_UPDATED đã tiến xa hơn', async () => {
    const { runner, run, resolveStart } = controls();
    const pending = runner.start();
    runner.update({ ...run, revision: 3, progress: { phase: 'CHECKOUT', message: 'Đã tới thanh toán' } });
    resolveStart(); await pending;
    expect(runner.run?.revision).toBe(3); expect(runner.run?.progress.phase).toBe('CHECKOUT');
    runner.update(run); expect(runner.run?.revision).toBe(3); runner.destroy();
  });
  it('STOP thắng START đang chờ và broadcast muộn của phiên đã hủy', async () => {
    const { runner, run, resolveStart } = controls();
    const pending = runner.start(); await runner.stop();
    runner.update(run); expect(runner.run).toBeNull();
    resolveStart(); await pending;
    runner.update(run); expect(runner.run).toBeNull(); runner.destroy();
  });
  it('STOP bị mất kết nối vẫn ngắt hành động cục bộ, không hồi sinh phiên cũ', async () => {
    const { runner, run, stop } = controls(); runner.update(run);
    stop.mockRejectedValueOnce(new Error('Disconnected'));
    await expect(runner.stop()).rejects.toThrow('Disconnected');
    runner.update(run); expect(runner.run).toBeNull(); runner.destroy();
  });
  it.each(['STOP', 'DOM_CHANGED'] as const)('không bấm nếu %s trong lúc persist đang chờ', async reason => {
    const config: TaskConfig = { schemaVersion: 1, enabled: true, panelVisible: true, preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo', saleStartAt: new Date(0).toISOString(), quantity: 1, preferredZoneLabels: [], allowAlternatives: false } };
    const run: AutoRun = { id: 'run', tabId: 1, revision: 0, preferencesKey: preferencesKey(config.preferences!), startedAt: Date.now(), expiresAt: Date.now() + 3600000, progress: { phase: 'READY', message: '' } };
    const execute = vi.fn();
    const inspection: PlatformInspection = { snapshot: { url: config.preferences!.eventUrl, state: 'EVENT_PAGE', supported: true, selectionMode: 'UNKNOWN', visibleOptions: [], reason: '' }, optionElements: [] };
    inspection.automation = { page: { snapshot: inspection.snapshot, enterCount: 1, advanceCount: 0, selectable: [] }, execute };
    let resolveCommit!: (run: AutoRun) => void;
    const committed = new Promise<AutoRun>(resolve => { resolveCommit = resolve; });
    const runner = createAutomationRunner({ initialRun: run, config: () => config, inspect: () => inspection, changed: vi.fn(), transport: {
      start: async () => run, stop: async () => null,
      commit: vi.fn().mockImplementationOnce(() => committed).mockImplementation(async (previous: AutoRun, progress) => ({ ...previous, revision: previous.revision + 1, progress })),
    } });
    const pending = runner.tick(inspection);
    if (reason === 'STOP') runner.update(null);
    else inspection.automation.page.enterCount = 2;
    resolveCommit({ ...run, revision: 1, progress: { phase: 'OPENING', message: '' } });
    await pending;
    if (reason === 'DOM_CHANGED') expect(runner.run?.progress.phase).toBe('PAUSED');
    else expect(runner.run).toBeNull();
    expect(execute).not.toHaveBeenCalled(); runner.destroy();
  });
  it.each([true, false])('khu hết vé trong lúc lưu bước: chỉ chọn lại khi adapter xác minh an toàn = %s', async safe => {
    const config: TaskConfig = { schemaVersion: 1, enabled: true, panelVisible: true, preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo', saleStartAt: new Date(0).toISOString(), quantity: 1, preferredZoneLabels: ['VIP'], allowAlternatives: false } };
    const run: AutoRun = { id: 'race', tabId: 1, revision: 0, preferencesKey: preferencesKey(config.preferences!), startedAt: Date.now(), expiresAt: Date.now() + 3600000, progress: { phase: 'READY', message: '' } };
    const execute = vi.fn();
    const inspection: PlatformInspection = { snapshot: { url: config.preferences!.eventUrl, state: 'SELECTING', supported: true, selectionMode: 'ZONE_ONLY', reason: '', visibleOptions: [{ id: 'vip', label: 'VIP', kind: 'ZONE', displayedPriceVnd: 900000, displayedAvailability: 'AVAILABLE' }] }, optionElements: [] };
    inspection.automation = { page: { snapshot: inspection.snapshot, enterCount: 0, advanceCount: 0, selectable: ['vip'], selectionRetrySafe: safe }, execute };
    const runner = createAutomationRunner({ initialRun: run, config: () => config, inspect: () => inspection, changed: vi.fn(), transport: {
      start: async () => run, stop: async () => null,
      commit: async (previous, progress) => {
        if (progress.phase === 'CHOOSING') inspection.snapshot.visibleOptions[0]!.displayedAvailability = 'UNAVAILABLE';
        return { ...previous, revision: previous.revision + 1, progress };
      },
    } });
    await runner.tick(inspection);
    expect(runner.run?.progress.phase).toBe(safe ? 'READY' : 'PAUSED');
    expect(runner.run?.progress.selectionRetries).toBe(safe ? 1 : undefined);
    expect(execute).not.toHaveBeenCalled(); runner.destroy();
  });
});
