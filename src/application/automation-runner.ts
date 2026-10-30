import { autoWatching, decideAutomation, preferencesKey, retryUnavailableSelection, SelectionUnavailableError, type AutoProgress, type AutoRun } from '../core/automation';
import type { TaskConfig } from '../core/models';
import type { PlatformInspection } from '../platforms/contracts';
import type { CampJournalEntry } from '../core/camp-journal';

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
  observe?(run: AutoRun, entry: CampJournalEntry): void;
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
  function observe(value: CampJournalEntry) {
    try { if (run) options.observe?.(run, value); } catch { /* Diagnostics never interrupt booking. */ }
  }
  function update(next: AutoRun | null) {
    if (disposed || (next && (stopping || (starting && startRevision !== controlRevision) || next.id === cancelledRunId))) return;
    if (next && run?.id === next.id && next.revision < run.revision) return;
    if (!next && run) { cancelledRunId = run.id; controlRevision++; }
    run = next;
    clearTimeout(wake);
    if (!disposed) options.changed();
  }
  async function tick(inspection: PlatformInspection) {
    if (busy || disposed || !run || !autoWatching(run) || !options.config().enabled) return;
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
          // The website may acknowledge a step while persistence is in flight.
          // Accept only an action-free transition proved by the same state machine.
          const recovery = fresh.automation &&
            decideAutomation(committed, fresh.automation.page, config.preferences, Date.now());
          // Opening/loading can win the race against a queued F5. Cancel that
          // refresh and inspect again; it must not interrupt admission or pause it.
          const cancelRefresh = decision.action.kind === 'RELOAD' && verified &&
            (verified.type === 'WAIT' || verified.progress.phase !== 'PAUSED');
          // No selection command has been sent yet. If the SDK replans while
          // storage is pending, discard this plan and re-read on the next tick.
          const replanSeats = decision.action.kind === 'CHOOSE' && !!decision.progress.chosen?.seatLabels &&
            !before.progress.chosen && before.progress.reservationAttemptedAt === undefined &&
            verified && (verified.type === 'WAIT' || verified.progress.phase === 'CHOOSING') &&
            !fresh.snapshot.visibleOptions.some(option => option.selected) &&
            fresh.snapshot.state === 'SELECTING';
          // A gate can appear before a selection click is sent. Preserve the
          // pre-action phase so admission does not wait for a click never made.
          const gatedSelection = before.progress.reservationAttemptedAt === undefined && ['CHOOSE', 'QUANTITY'].includes(decision.action.kind) &&
            (fresh.snapshot.state === 'WAITING_ROOM' || (fresh.snapshot.state === 'CHALLENGE' && fresh.automation?.page.verificationPending && !fresh.automation.page.problem));
          run = await options.transport.commit(committed, gatedSelection ? before.progress : recovery && recovery.type === 'STEP' && !recovery.action
            ? recovery.progress
            : cancelRefresh ? (decision.progress.phase === 'RECOVERING'
              ? { ...committed.progress, phase: 'PAUSED', message: 'Kết quả giữ vé đã đổi. Chờ xác nhận trên tab; không tải lại.' }
              : before.progress)
              : replanSeats ? retryUnavailableSelection(before.progress, Date.now())
              : { ...committed.progress, phase: 'PAUSED', message: 'Trang đã đổi trong lúc chuẩn bị thao tác. Kiểm tra rồi bắt đầu lại.' });
          return;
        }
        observe({ at: Date.now(), kind: 'ACTION', phase: run.progress.phase, action: decision.action.kind, url: fresh.snapshot.url });
        fresh.automation!.execute(decision.action);
      }
    } catch (error) {
      observe({ at: Date.now(), kind: 'ACTION_ERROR', phase: run?.progress.phase, action: decision.action?.kind,
        code: error instanceof SelectionUnavailableError ? 'SELECTION_UNAVAILABLE' : 'ACTION_FAILED' });
      if (run && run.id === before.id) {
        const current = run;
        const retry = error instanceof SelectionUnavailableError && decision.action?.kind === 'CHOOSE';
        const progress: AutoProgress = retry
          ? retryUnavailableSelection(current.progress, Date.now())
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
