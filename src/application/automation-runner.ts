import { autoActive, decideAutomation, preferencesKey, type AutoProgress, type AutoRun } from '../core/automation';
import type { TaskConfig } from '../core/models';
import type { PlatformInspection } from '../platforms/contracts';

export interface AutomationTransport {
  start(): Promise<AutoRun | null>;
  stop(): Promise<AutoRun | null>;
  commit(run: AutoRun, progress: AutoProgress): Promise<AutoRun | null>;
}
interface RunnerOptions {
  initialRun?: AutoRun | null;
  transport: AutomationTransport;
  config(): TaskConfig;
  inspect(): PlatformInspection;
  changed(): void;
}

/** Owns scheduling/serialization. Website-specific reads and writes stay in adapters. */
export function createAutomationRunner(options: RunnerOptions) {
  let run = options.initialRun ?? null;
  let busy = false;
  let disposed = false;
  let wake: ReturnType<typeof setTimeout> | undefined;
  function update(next: AutoRun | null) {
    run = next;
    clearTimeout(wake);
    if (!disposed) options.changed();
  }
  async function tick(inspection: PlatformInspection) {
    if (busy || disposed || !run || !autoActive(run) || !options.config().enabled) return;
    const p = options.config().preferences;
    if (!p || !inspection.automation) return;
    const before = run;
    const decision = decideAutomation(before, inspection.automation.page, p, Date.now());
    clearTimeout(wake);
    if (decision.type === 'WAIT') {
      if (decision.wakeAt !== undefined) wake = setTimeout(() => options.changed(), Math.min(60000, Math.max(1, decision.wakeAt - Date.now())));
      return;
    }
    busy = true;
    try {
      const committed = await options.transport.commit(before, decision.progress);
      if (disposed || !committed || !run || run.id !== before.id || run.revision > committed.revision) return;
      run = committed;
      if (decision.action) {
        // Persistence crossed an async boundary. Re-read and re-decide before touching DOM.
        const config = options.config();
        if (!config.enabled || !config.preferences || preferencesKey(config.preferences) !== before.preferencesKey) return;
        const fresh = options.inspect();
        const verified = fresh.automation && decideAutomation(before, fresh.automation.page, config.preferences, Date.now());
        if (!verified || verified.type !== 'STEP' || JSON.stringify(verified.action) !== JSON.stringify(decision.action) ||
            JSON.stringify(verified.progress.chosen) !== JSON.stringify(decision.progress.chosen)) {
          run = await options.transport.commit(committed, { ...committed.progress, phase: 'PAUSED', message: 'Trang đã đổi trong lúc chuẩn bị thao tác. Kiểm tra rồi bắt đầu lại.' });
          return;
        }
        fresh.automation!.execute(decision.action);
      }
    } catch (error) {
      if (run && run.id === before.id) {
        const current = run;
        const progress: AutoProgress = { ...current.progress, phase: 'PAUSED', message: error instanceof Error ? error.message : 'Camp bị gián đoạn. Kiểm tra trang.' };
        try { run = await options.transport.commit(current, progress); }
        catch { run = { ...current, progress }; }
      }
    } finally {
      busy = false;
      if (!disposed) options.changed();
    }
  }
  return {
    get run() { return run; },
    update,
    tick,
    async start() { update(await options.transport.start()); },
    async stop() { update(await options.transport.stop()); },
    destroy() { disposed = true; clearTimeout(wake); },
  };
}
