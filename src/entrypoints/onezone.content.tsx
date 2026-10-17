import { defineContentScript } from 'wxt/utils/define-content-script';
import { mountAssistant } from '../ui/mount-assistant';
import { repository, watchConfig } from '../infrastructure/storage';
import { command } from '../infrastructure/messages';

export default defineContentScript({
  matches: ['https://ticket.1zone.vn/*'],
  runAt: 'document_idle',
  async main(ctx) {
    let disposed = false;
    ctx.onInvalidated(() => { disposed = true; });
    // Subscribe before the initial async load to avoid missing a concurrent save.
    let latest: Awaited<ReturnType<typeof repository.load>> | undefined;
    let mounted: ReturnType<typeof mountAssistant> | undefined;
    const unwatch = watchConfig(config => { latest = config; mounted?.update(config); });
    ctx.onInvalidated(unwatch);
    const initial = await repository.load();
    if (disposed) return;
    mounted = mountAssistant({
      document, getUrl: () => location.href, initialConfig: latest ?? initial,
      onStop: () => command({ type: 'ENABLE', enabled: false }),
      onHide: () => command({ type: 'PANEL', visible: false }),
      onOpen: () => command({ type: 'OPEN_EVENT' }),
    });
    ctx.addEventListener(window, 'wxt:locationchange', () => mounted?.rescan());
    ctx.onInvalidated(() => mounted?.destroy());
  },
});
