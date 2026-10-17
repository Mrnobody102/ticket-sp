import { defineContentScript } from 'wxt/utils/define-content-script';
import { mountAssistant } from '../ui/mount-assistant';
import { repository, watchConfig } from '../infrastructure/storage';
import { command } from '../infrastructure/messages';
import { contentMatches } from '../core/platform-catalog';
import { autoCommand, watchAutoRun } from '../infrastructure/automation-messages';
import { chromeAutomationTransport } from '../infrastructure/automation-transport';
import type { AutoRun } from '../core/automation';
import { loadAssistantState } from '../application/assistant-bootstrap';

export default defineContentScript({
  matches: [...contentMatches],
  runAt: 'document_idle',
  async main(ctx) {
    let disposed = false;
    ctx.onInvalidated(() => { disposed = true; });
    // Subscribe before the initial async load to avoid missing a concurrent save.
    let latest: Awaited<ReturnType<typeof repository.load>> | undefined;
    let mounted: ReturnType<typeof mountAssistant> | undefined;
    const unwatch = watchConfig(config => { latest = config; mounted?.update(config); });
    ctx.onInvalidated(unwatch);
    let latestRun: AutoRun | null | undefined;
    ctx.onInvalidated(watchAutoRun(run => { latestRun = run; mounted?.updateAuto(run); }));
    const initial = await loadAssistantState(() => repository.load(), () => autoCommand({ type: 'AUTO_GET' }));
    if (disposed) return;
    mounted = mountAssistant({
      document, getUrl: () => location.href, initialConfig: latest ?? initial.config, initialError: initial.error,
      onStop: () => command({ type: 'ENABLE', enabled: false }),
      onHide: () => command({ type: 'PANEL', visible: false }),
      onOpen: () => command({ type: 'OPEN_EVENT' }),
      automation: initial.error ? undefined : { initialRun: latestRun !== undefined ? latestRun : initial.run, transport: chromeAutomationTransport },
    });
    ctx.addEventListener(window, 'wxt:locationchange', () => mounted?.rescan());
    ctx.onInvalidated(() => mounted?.destroy());
  },
});
