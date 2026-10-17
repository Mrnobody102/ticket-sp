import { createRoot } from 'react-dom/client';
import type { PageSnapshot, TaskConfig } from '../core/models';
import { inspectOnezonePage } from '../platforms/onezone';
import { effectiveSnapshot, recommend } from '../core/workflow';
import { Panel } from './Panel';
import style from './styles.css?inline';

interface MountOptions {
  document: Document;
  getUrl: () => string;
  initialConfig: TaskConfig;
  onStop: () => Promise<unknown>;
  onHide: () => Promise<unknown>;
  onOpen: () => Promise<unknown>;
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
  let error: string | undefined;
  let stopped = false;
  let timeout: number | undefined;
  let frame: number | undefined;
  let highlighted: Element[] = [];
  let lastRun = 0;
  let lastSnapshot: PageSnapshot = {
    url: options.getUrl(), state: 'UNKNOWN', selectionMode: 'UNKNOWN', visibleOptions: [], supported: false, reason: '',
  };

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
    const url = new URL(options.getUrl());
    // Stopped/hidden tasks do no DOM inspection; config changes can resume immediately.
    const inspection = config.enabled && config.panelVisible
      ? inspectOnezonePage(document, url)
      : { snapshot: { ...lastSnapshot, url: url.href }, optionElements: [] };
    const raw = inspection.snapshot;
    lastSnapshot = raw;
    const snapshot = effectiveSnapshot(raw, config);
    const recommendations = config.preferences && config.panelVisible ? recommend(snapshot, config.preferences) : [];
    const entries = inspection.optionElements;
    const ids = new Set(recommendations.slice(0, 4).map(r => r.option.id));
    highlighted = config.panelVisible ? entries.filter(e => ids.has(e.option.id)).map(e => e.element) : [];
    drawHighlights();
    host.style.display = config.panelVisible ? '' : 'none';
    root.render(<Panel config={config} snapshot={snapshot} recommendations={recommendations} error={error} onRescan={scan}
      onStop={() => void runAction(options.onStop)} onHide={() => void runAction(options.onHide)} onOpen={() => void runAction(options.onOpen)} />);
  }
  // Trailing throttle: frequent mutations cannot starve recognition or exceed ~2 scans/s.
  function schedule() {
    if (timeout !== undefined || stopped || !config.enabled || !config.panelVisible) return;
    timeout = view.setTimeout(() => { timeout = undefined; scan(); }, Math.max(100, 600 - (Date.now() - lastRun)));
  }
  const observer = new MutationObserver(records => {
    if (records.some(r => r.target !== host && !host.contains(r.target))) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['hidden', 'style', 'class', 'aria-hidden', 'aria-disabled', 'disabled', 'aria-label', 'inert', 'aria-selected', 'aria-checked', 'checked', 'value'] });
  view.addEventListener('scroll', drawSoon, true);
  view.addEventListener('resize', schedule);
  view.addEventListener('popstate', schedule);
  view.addEventListener('hashchange', schedule);
  document.addEventListener('visibilitychange', schedule);
  scan();
  return {
    update(next: TaskConfig) { config = next; scan(); },
    rescan: schedule,
    destroy() {
      stopped = true; observer.disconnect(); view.clearTimeout(timeout);
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      view.removeEventListener('scroll', drawSoon, true); view.removeEventListener('resize', schedule);
      view.removeEventListener('popstate', schedule); view.removeEventListener('hashchange', schedule);
      document.removeEventListener('visibilitychange', schedule); root.unmount(); host.remove();
    },
  };
}
