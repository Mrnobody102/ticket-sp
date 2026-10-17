import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutomationRunner } from '../../src/application/automation-runner';
import { preferencesKey, type AutoRun } from '../../src/core/automation';
import type { TaskConfig } from '../../src/core/models';
import type { PlatformInspection } from '../../src/platforms/contracts';

afterEach(() => vi.useRealTimers());
describe('runner độc lập platform', () => {
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
});
