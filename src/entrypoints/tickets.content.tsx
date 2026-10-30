import { defineContentScript } from 'wxt/utils/define-content-script';
import { mountAssistant } from '../ui/mount-assistant';
import { repository, watchConfig } from '../infrastructure/storage';
import { command } from '../infrastructure/messages';
import { contentMatches } from '../core/platform-catalog';
import { autoCommand, watchAutoRun } from '../infrastructure/automation-messages';
import { chromeAutomationTransport } from '../infrastructure/automation-transport';
import { loadAssistantState } from '../application/assistant-bootstrap';
import { RUNTIME_INFO, verifyExtensionRuntime } from '../infrastructure/extension-runtime';

export default defineContentScript({
  matches: [...contentMatches],
  // Observe the usable DOM without waiting for images/fonts/window.load.
  runAt: 'document_end',
  async main(ctx) {
    const observationOnly = location.origin === 'https://ticketbox.vn';
    let disposed = false;
    let runtimeReady = false, booting = false, failed = false, retries = 0;
    let retryTimer: number | undefined;
    // Subscribe before the initial async load to avoid missing a concurrent save.
    let latest: Awaited<ReturnType<typeof repository.load>> | undefined;
    let mounted: ReturnType<typeof mountAssistant> | undefined;
    ctx.onInvalidated(() => { disposed = true; runtimeReady = false; window.clearTimeout(retryTimer); mounted?.destroy(); });
    // Register once, before AUTO_GET: popup START can be waiting on readiness
    // while run reads wait in the worker's serialized queue.
    const ready = (message: unknown, sender: chrome.runtime.MessageSender, respond: (reply: unknown) => void) => {
      if (!disposed && runtimeReady && sender.id === chrome.runtime.id && message && typeof message === 'object' && 'type' in message && message.type === 'CONTENT_READY') respond({ info: RUNTIME_INFO });
    };
    chrome.runtime.onMessage.addListener(ready);
    ctx.onInvalidated(() => chrome.runtime.onMessage.removeListener(ready));
    const unwatch = watchConfig(config => { latest = config; mounted?.update(config); });
    ctx.onInvalidated(unwatch);
    let runUpdates = 0;
    ctx.onInvalidated(watchAutoRun(run => {
      runUpdates++;
      if (failed) void bootstrap(); else mounted?.updateAuto(run);
    }));
    async function bootstrap() {
      if (disposed || booting) return;
      booting = true; runtimeReady = false;
      window.clearTimeout(retryTimer); retryTimer = undefined;
      try {
        const readState = () => loadAssistantState(() => repository.load(), async () => {
          runtimeReady = false;
          await verifyExtensionRuntime();
          if (disposed) return null;
          runtimeReady = true;
          return autoCommand({ type: 'AUTO_GET' });
        });
        let updatesBeforeRead = runUpdates;
        let initial = await readState();
        // Broadcasts wake recovery, but only a stable owner GET may restore a
        // run. A concurrent START/STOP requires another authoritative read.
        for (let attempt = 0; !disposed && !initial.error && runUpdates !== updatesBeforeRead && attempt < 2; attempt++) {
          updatesBeforeRead = runUpdates;
          initial = await readState();
        }
        if (disposed) return;
        if (!initial.error && runUpdates !== updatesBeforeRead) initial = { ...initial, run: null, error: 'Phiên camp đang cập nhật. Đang kết nối lại.' };
        failed = !!initial.error;
        mounted?.destroy();
        mounted = mountAssistant({
          document, getUrl: () => location.href, initialConfig: latest ?? initial.config, initialError: initial.error,
          observationOnly,
          onStop: () => command({ type: 'ENABLE', enabled: false }),
          onHide: () => command({ type: 'PANEL', visible: false }),
          onOpen: () => command({ type: 'OPEN_EVENT' }),
          automation: initial.error || observationOnly ? undefined : { initialRun: initial.run, transport: chromeAutomationTransport },
        });
      } finally {
        booting = false;
        // Retry reads only, never START/STEP or a website action. Guard updates
        // can retry later if the worker remains unavailable after these attempts.
        if (!disposed && failed && retries < 2) retryTimer = window.setTimeout(() => { retryTimer = undefined; void bootstrap(); }, ++retries * 500);
      }
    }
    ctx.addEventListener(window, 'wxt:locationchange', () => mounted?.rescan());
    await bootstrap();
  },
});
