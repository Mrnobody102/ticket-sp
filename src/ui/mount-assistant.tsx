import { createRoot } from 'react-dom/client';
import type { PageSnapshot, TaskConfig } from '../core/models';
import { inspectPlatform } from '../platforms/registry';
import { createAutomationRunner, type AutomationTransport } from '../application/automation-runner';
import { autoActive, type AutoRun } from '../core/automation';
import type { PlatformInspection } from '../platforms/contracts';
import { effectiveSnapshot, recommend } from '../core/workflow';
import { Panel } from './Panel';
import style from './styles.css?inline';

interface MountOptions {
  document: Document;
  getUrl: () => string;
  initialConfig: TaskConfig;
  initialError?: string;
  rehearsal?: boolean;
  onStop: () => Promise<unknown>;
  onHide: () => Promise<unknown>;
  onOpen: () => Promise<unknown>;
  automation?: { initialRun?: AutoRun | null; transport: AutomationTransport };
}

export function mountAssistant(options: MountOptions) {
  const { document } = options;
  const view = document.defaultView!;
  // Defensive idempotence for dev reloads or reinjection.
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
  let stopped = false;
  let timeout: number | undefined;
  let microtaskQueued = false;
  let frame: number | undefined;
  let highlighted: Element[] = [];
  let lastRun = 0;
  let lastSnapshot: PageSnapshot = {
    url: options.getUrl(), state: 'UNKNOWN', selectionMode: 'UNKNOWN', visibleOptions: [], supported: false, reason: '',
  };
  function inspect(): PlatformInspection {
    const run = runner?.run;
    return inspectPlatform(document, new URL(options.getUrl()), config.preferences ? { preferences: config.preferences, progress: run?.progress ?? { phase: 'READY', message: '' } } : undefined);
  }
  const runner = options.automation ? createAutomationRunner({
    ...options.automation, config: () => config, inspect,
    changed: () => { if (!stopped) schedule(true); },
  }) : undefined;

  function drawHighlights() {
    overlay.replaceChildren();
    for (const element of highlighted) {
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
    const inspection = config.enabled && (config.panelVisible || autoActive(runner?.run ?? null))
      ? inspect()
      : { snapshot: { ...lastSnapshot, url: options.getUrl() }, optionElements: [] };
    const raw = inspection.snapshot;
    // Start the state transition before computing highlights and rendering the panel.
    void runner?.tick(inspection).catch(e => { error = e instanceof Error ? e.message : 'Không đọc được trang vé.'; });
    lastSnapshot = raw;
    const snapshot = effectiveSnapshot(raw, config);
    const recommendations = config.preferences && config.panelVisible ? recommend(snapshot, config.preferences) : [];
    const entries = inspection.optionElements;
    const ids = new Set(recommendations.slice(0, 4).map(r => r.option.id));
    highlighted = config.panelVisible ? entries.filter(e => ids.has(e.option.id)).map(e => e.element) : [];
    drawHighlights();
    host.style.display = config.panelVisible ? '' : 'none';
    root.render(<Panel config={config} snapshot={snapshot} recommendations={recommendations} error={error} onRescan={scan}
      rehearsal={options.rehearsal} background={document.visibilityState === 'hidden'} autoRun={runner?.run} autoBusy={runner?.pendingControl} onStartAuto={runner && !options.rehearsal ? () => void runAction(() => runner.start()) : undefined}
      onStopAuto={runner ? () => void runAction(() => runner.stop()) : undefined}
      onStop={() => void runAction(options.onStop)} onHide={() => void runAction(options.onHide)} onOpen={() => void runAction(options.onOpen)} />);
  }
  // Active automation runs at the next microtask; passive UI scans remain throttled.
  function schedule(urgent = false) {
    const active = autoActive(runner?.run ?? null);
    if (stopped || !config.enabled || (!config.panelVisible && !active)) return;
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
  const observer = new MutationObserver(records => {
    if (records.some(r => r.target !== host && !host.contains(r.target))) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['hidden', 'style', 'class', 'aria-hidden', 'aria-disabled', 'disabled', 'aria-label', 'aria-labelledby', 'inert', 'role', 'href', 'min', 'max', 'aria-valuemin', 'aria-valuemax', 'aria-selected', 'aria-checked', 'aria-pressed', 'aria-valuenow', 'checked', 'value', 'data-ticket-class-id', 'data-ticket-type-id', 'data-id'] });
  view.addEventListener('scroll', drawSoon, true);
  view.addEventListener('resize', scheduleEvent);
  view.addEventListener('popstate', scheduleEvent);
  view.addEventListener('hashchange', scheduleEvent);
  document.addEventListener('visibilitychange', scheduleEvent);
  document.addEventListener('input', scheduleEvent, true);
  document.addEventListener('change', scheduleEvent, true);
  scan();
  return {
    update(next: TaskConfig) { config = next; scan(); },
    updateAuto(next: AutoRun | null) { runner?.update(next); scan(); },
    rescan: scheduleEvent,
    startAuto: () => runAction(async () => { await runner?.start(); }),
    destroy() {
      stopped = true; observer.disconnect(); view.clearTimeout(timeout);
      runner?.destroy();
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      view.removeEventListener('scroll', drawSoon, true); view.removeEventListener('resize', scheduleEvent);
      view.removeEventListener('popstate', scheduleEvent); view.removeEventListener('hashchange', scheduleEvent);
      document.removeEventListener('visibilitychange', scheduleEvent);
      document.removeEventListener('input', scheduleEvent, true); document.removeEventListener('change', scheduleEvent, true);
      root.unmount(); host.remove();
    },
  };
}
