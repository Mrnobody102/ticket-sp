import { createRoot } from 'react-dom/client';
import type { PageSnapshot, TaskConfig } from '../core/models';
import { inspectPlatform } from '../platforms/registry';
import { createAutomationRunner, type AutomationTransport } from '../application/automation-runner';
import { autoWatching, type AutoRun } from '../core/automation';
import type { PlatformInspection } from '../platforms/contracts';
import { effectiveSnapshot, recommend } from '../core/workflow';
import { Panel } from './Panel';
import style from './styles.css?inline';
import { createCampReport } from '../core/camp-report';
import { saveCampReport } from './save-camp-report';
import { EXTENSION_VERSION } from '../infrastructure/extension-runtime';
import { MAP_CHANGED } from '../platforms/onezone-map-bridge';
import { ORDER_ACTIVITY, SEATS_CANCEL } from '../platforms/onezone-seats-bridge';
import { getCampJournal, observeCamp } from '../infrastructure/camp-journal';
import type { CampJournalEntry } from '../core/camp-journal';
import { readSeatsState } from '../platforms/onezone-seats';
import { observeOnezoneOrder } from '../platforms/onezone-automation';

interface MountOptions {
  document: Document;
  getUrl: () => string;
  initialConfig: TaskConfig;
  initialError?: string;
  rehearsal?: boolean;
  observationOnly?: boolean;
  onStop: () => Promise<unknown>;
  onHide: () => Promise<unknown>;
  onOpen: () => Promise<unknown>;
  automation?: { initialRun?: AutoRun | null; transport: AutomationTransport };
}
const mountedAssistants = new WeakMap<Document, () => void>();

export function mountAssistant(options: MountOptions) {
  const { document } = options;
  const view = document.defaultView!;
  // Defensive idempotence for dev reloads or reinjection.
  mountedAssistants.get(document)?.();
  document.querySelector('[data-ticket-assistant]')?.remove();
  const host = document.createElement('div');
  host.setAttribute('data-ticket-assistant', '');
  host.style.cssText = 'all:initial;position:fixed;bottom:16px;left:16px;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  const stylesheet = document.createElement('style');
  stylesheet.textContent = style + '\n.mount{pointer-events:auto}.highlights{pointer-events:none}.highlight{position:fixed;border:3px solid #3b9870;border-radius:10px;box-shadow:0 0 0 3px #ffffffaa;pointer-events:none;}';
  const container = document.createElement('div'); container.className = 'mount';
  const overlay = document.createElement('div'); overlay.className = 'highlights';
  shadow.append(stylesheet, overlay, container); document.documentElement.append(host);
  const root = createRoot(container);
  let config = options.initialConfig;
  let error = options.initialError;
  let inspectionFailed = false;
  let stopped = false;
  let timeout: number | undefined;
  let microtaskQueued = false;
  let frame: number | undefined;
  let highlighted: Element[] = [];
  let lastRun = 0;
  let lastObserved = '';
  let lastSnapshot: PageSnapshot = {
    url: options.getUrl(), state: 'UNKNOWN', selectionMode: 'UNKNOWN', visibleOptions: [], supported: false, reason: '',
  };
  function inspect(): PlatformInspection {
    const run = runner?.run;
    return inspectPlatform(document, new URL(options.getUrl()), config.preferences ? { preferences: config.preferences, progress: run?.progress ?? { phase: 'READY', message: '' } } : undefined);
  }
  const runner = options.automation ? createAutomationRunner({
    ...options.automation, config: () => config, inspect,
    observe: observeCamp,
    changed: () => { if (!stopped) schedule(true); },
  }) : undefined;

  function drawHighlights() {
    overlay.replaceChildren();
    for (const element of new Set(highlighted)) {
      // Keep the interactive iframe completely unobstructed.
      if (element.matches('#seatio') || element.closest('#seatio')) continue;
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > view.innerHeight) continue;
      const box = document.createElement('div'); box.className = 'highlight';
      box.style.cssText = `top:${rect.top - 3}px;left:${rect.left - 3}px;width:${rect.width + 6}px;height:${rect.height + 6}px;`;
      overlay.append(box);
    }
  }
  function drawSoon() {
    if (frame === undefined) frame = view.requestAnimationFrame(() => { frame = undefined; drawHighlights(); });
  }
  async function runAction(action: () => Promise<unknown>) {
    try { error = undefined; await action(); } catch (e) { error = e instanceof Error ? e.message : 'Không thể thực hiện thao tác.'; }
    scan();
  }
  function scan() {
    if (stopped) return;
    lastRun = Date.now();
    let inspection: PlatformInspection;
    try {
      inspection = (config.enabled || options.observationOnly) && (config.panelVisible || autoWatching(runner?.run ?? null))
        ? inspect()
        : { snapshot: { ...lastSnapshot, url: options.getUrl() }, optionElements: [] };
      if (inspectionFailed) { inspectionFailed = false; error = undefined; }
    } catch {
      inspectionFailed = true;
      error = 'Chưa đọc được trang vé. Đang thử lại.';
      inspection = { snapshot: { ...lastSnapshot, url: options.getUrl(), state: 'UNKNOWN', supported: false, unsupportedVariant: false, visibleOptions: [], reason: error }, optionElements: [] };
    }
    const raw = inspection.snapshot;
    const run = runner?.run;
    if (run && autoWatching(run) && !options.rehearsal) {
      const seats = readSeatsState(document);
      const entry: CampJournalEntry = { at: Date.now(), kind: 'PAGE', url: raw.url, state: raw.state,
        phase: run.progress.phase, optionCount: raw.visibleOptions.length,
        selectedCount: raw.visibleOptions.filter(o => o.selected).length, quantity: inspection.automation?.page.quantity?.value,
        code: inspectionFailed ? 'PAGE_READ_FAILED' : raw.state === 'CHALLENGE' ? 'VERIFICATION' : raw.state === 'WAITING_ROOM' ? 'QUEUE' : raw.state === 'CHECKOUT' ? 'CHECKOUT'
          : inspection.automation?.page.problem?.startsWith('Đăng nhập') ? 'LOGIN' : seats?.problem ? 'SDK_ERROR'
          : seats?.ready && !seats.groups.length ? 'SDK_NO_STOCK' : seats?.groups.length && !raw.visibleOptions.length ? 'PRICE_UNVERIFIED'
          : seats && !seats.ready ? 'SDK_LOADING' : raw.unsupportedVariant ? 'UNSUPPORTED_MAP' : undefined };
      const key = run.id + JSON.stringify({ ...entry, at: 0 });
      if (key !== lastObserved) { lastObserved = key; observeCamp(run, entry); }
    }
    // Start the state transition before computing highlights and rendering the panel.
    void runner?.tick(inspection).catch(e => { error = e instanceof Error ? e.message : 'Không đọc được trang vé.'; });
    lastSnapshot = raw;
    const snapshot = options.observationOnly ? raw : effectiveSnapshot(raw, config);
    const recommendations = config.preferences && config.panelVisible ? recommend(snapshot, config.preferences) : [];
    const entries = inspection.optionElements;
    const ids = new Set(recommendations.slice(0, 4).map(r => r.option.id));
    highlighted = config.panelVisible ? entries.filter(e => ids.has(e.option.id)).map(e => e.element) : [];
    drawHighlights();
    host.style.display = config.panelVisible ? '' : 'none';
    root.render(<Panel config={config} snapshot={snapshot} recommendations={recommendations} error={error} onRescan={scan} observationOnly={options.observationOnly}
      rehearsal={options.rehearsal} background={document.visibilityState === 'hidden'} autoRun={runner?.run} autoBusy={runner?.pendingControl} onStartAuto={runner && !options.rehearsal ? () => void runAction(() => runner.start()) : undefined}
      onStopAuto={runner ? () => void runAction(() => runner.stop()) : undefined}
      onSaveReport={() => void runAction(async () => {
        try {
          const current = inspect();
          const journal = await getCampJournal().catch(() => null);
          saveCampReport(document, { ...createCampReport(EXTENSION_VERSION, options.observationOnly ? null : config.preferences, current.snapshot, runner?.run ?? null, current.automation?.page.quantity?.value, error), journal,
            seatMap: readSeatsState(document)?.diagnostics });
        } catch (e) { error = e instanceof Error ? e.message : 'Không lưu được báo cáo.'; scan(); }
      })}
      onStop={() => void runAction(options.onStop)} onHide={() => void runAction(options.onHide)} onOpen={() => void runAction(options.onOpen)} />);
  }
  // Active automation runs at the next microtask; passive UI scans remain throttled.
  function schedule(urgent = false) {
    const active = autoWatching(runner?.run ?? null);
    if (stopped || (!config.enabled && !options.observationOnly) || (!config.panelVisible && !active)) return;
    if (active || urgent) {
      view.clearTimeout(timeout); timeout = undefined;
      if (!microtaskQueued) {
        microtaskQueued = true;
        view.queueMicrotask(() => { microtaskQueued = false; scan(); });
      }
    } else if (timeout === undefined && !microtaskQueued) {
      timeout = view.setTimeout(() => { timeout = undefined; scan(); }, Math.max(100, 600 - (Date.now() - lastRun)));
    }
  }
  const scheduleEvent = () => schedule();
  const observeOrder = (event: Event) => {
    const run = runner?.run;
    if (!run || options.rehearsal || (!autoWatching(run) && (run.progress.phase !== 'CHECKOUT' || Date.now() - (run.progress.checkoutReachedAt ?? 0) > 10000))) return;
    try {
      const value = JSON.parse((event as CustomEvent<string>).detail);
      if (value.kind === 'ORDER') {
        if (config.preferences) observeOnezoneOrder(document, value, config.preferences, run.progress);
        observeCamp(run, { ...value, at: Date.now(), phase: run.progress.phase });
        schedule(true);
      }
    } catch { /* Ignore unrelated page events. */ }
  };
  const observer = new MutationObserver(records => {
    if (records.some(r => r.target !== host && !host.contains(r.target))) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['hidden', 'style', 'class', 'aria-hidden', 'aria-disabled', 'disabled', 'readonly', 'aria-readonly', 'aria-label', 'aria-labelledby', 'alt', 'title', 'inert', 'role', 'href', 'min', 'max', 'aria-valuemin', 'aria-valuemax', 'aria-selected', 'aria-checked', 'aria-pressed', 'aria-valuenow', 'checked', 'value', 'data-ticket-class-id', 'data-ticket-type-id', 'data-zone-id', 'data-id'] });
  view.addEventListener('scroll', drawSoon, true);
  view.addEventListener('resize', scheduleEvent);
  view.addEventListener('load', scheduleEvent);
  view.addEventListener('online', scheduleEvent);
  view.addEventListener('pageshow', scheduleEvent);
  view.addEventListener('popstate', scheduleEvent);
  view.addEventListener('hashchange', scheduleEvent);
  document.addEventListener('visibilitychange', scheduleEvent);
  document.addEventListener('input', scheduleEvent, true);
  document.addEventListener('change', scheduleEvent, true);
  document.addEventListener(MAP_CHANGED, scheduleEvent);
  document.addEventListener(ORDER_ACTIVITY, observeOrder);
  // Active runs already schedule their next read through runner.tick(). Only
  // retry passive SDK loading or failed inspections here, avoiding duplicate scans.
  const heartbeat = view.setInterval(() => {
    if (inspectionFailed || (!autoWatching(runner?.run ?? null) && lastSnapshot.unsupportedVariant === false)) schedule();
  }, 1000);
  const mounted = {
    update(next: TaskConfig) { config = next; scan(); },
    updateAuto(next: AutoRun | null) {
      if (!autoWatching(next)) document.dispatchEvent(new CustomEvent(SEATS_CANCEL));
      if (runner) runner.update(next); else schedule(true);
    },
    rescan: scheduleEvent,
    startAuto: () => runAction(async () => { await runner?.start(); }),
    destroy() {
      if (stopped) return;
      stopped = true; observer.disconnect(); view.clearTimeout(timeout); view.clearInterval(heartbeat);
      document.dispatchEvent(new CustomEvent(SEATS_CANCEL));
      runner?.destroy();
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      view.removeEventListener('scroll', drawSoon, true); view.removeEventListener('resize', scheduleEvent);
      view.removeEventListener('load', scheduleEvent);
      view.removeEventListener('online', scheduleEvent);
      view.removeEventListener('pageshow', scheduleEvent);
      view.removeEventListener('popstate', scheduleEvent); view.removeEventListener('hashchange', scheduleEvent);
      document.removeEventListener('visibilitychange', scheduleEvent);
      document.removeEventListener('input', scheduleEvent, true); document.removeEventListener('change', scheduleEvent, true);
      document.removeEventListener(MAP_CHANGED, scheduleEvent);
      document.removeEventListener(ORDER_ACTIVITY, observeOrder);
      root.unmount(); host.remove();
      if (mountedAssistants.get(document) === mounted.destroy) mountedAssistants.delete(document);
    },
  };
  mountedAssistants.set(document, mounted.destroy);
  scan();
  return mounted;
}
