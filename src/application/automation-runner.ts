import { autoActive, decideAutomation, preferencesKey, SelectionUnavailableError, type AutoProgress, type AutoRun } from '../core/automation';
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
  let starting = false;
  let stopping = false;
  let controlRevision = 0;
  let startRevision = 0;
  let cancelledRunId: string | undefined;
  let wake: ReturnType<typeof setTimeout> | undefined;
  function update(next: AutoRun | null) {
    if (disposed || (next && (stopping || (starting && startRevision !== controlRevision) || next.id === cancelledRunId))) return;
    if (next && run?.id === next.id && next.revision < run.revision) return;
    if (!next && run) { cancelledRunId = run.id; controlRevision++; }
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
          // Nothing has been clicked yet. The same state machine may prove the
          // chosen zone became unavailable and permit a bounded selection retry.
          const recovery = decision.action.kind === 'CHOOSE' && fresh.automation &&
            decideAutomation(committed, fresh.automation.page, config.preferences, Date.now());
          run = await options.transport.commit(committed, recovery && recovery.type === 'STEP' && recovery.progress.phase === 'READY' && !recovery.action
            ? recovery.progress
            : { ...committed.progress, phase: 'PAUSED', message: 'Trang đã đổi trong lúc chuẩn bị thao tác. Kiểm tra rồi bắt đầu lại.' });
          return;
        }
        fresh.automation!.execute(decision.action);
      }
    } catch (error) {
      if (run && run.id === before.id) {
        const current = run;
        const retry = error instanceof SelectionUnavailableError && decision.action?.kind === 'CHOOSE' && (current.progress.selectionRetries ?? 0) < 5;
        const progress: AutoProgress = retry
          ? { ...current.progress, phase: 'READY', chosen: undefined, actionAt: undefined, selectionRetries: (current.progress.selectionRetries ?? 0) + 1, message: 'Khu vừa chọn hết vé. Đang tìm khu khác đúng ưu tiên.' }
          : { ...current.progress, phase: 'PAUSED', message: error instanceof Error ? error.message : 'Camp bị gián đoạn. Kiểm tra trang.' };
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
    get pendingControl() { return starting || stopping; },
    update,
    tick,
    async start() {
      if (disposed || starting || stopping) return;
      starting = true; startRevision = ++controlRevision;
      const revision = startRevision;
      options.changed();
      try {
        const next = await options.transport.start();
        if (disposed) return;
        if (revision !== controlRevision) { if (next) cancelledRunId = next.id; return; }
        // AUTO_UPDATED can arrive before the command response, already carrying
        // newer progress. A delayed START response must not rewind that state.
        if (!next || run?.id !== next.id) update(next);
      } finally { starting = false; if (!disposed) options.changed(); }
    },
    async stop() {
      if (disposed || stopping) return;
      stopping = true; controlRevision++;
      update(null); // Cancel pending local actions before awaiting the worker.
      try { await options.transport.stop(); }
      finally { stopping = false; if (!disposed) options.changed(); }
    },
    destroy() { disposed = true; controlRevision++; clearTimeout(wake); },
  };
}
