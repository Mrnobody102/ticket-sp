import type { BrowserPlatformAdapter, PlatformInspection } from './contracts';
import { inspectOnezonePage, onezoneAdapter } from './onezone';
import { executeAutoAction, inspectAutoControls } from './onezone-automation';

const adapters: readonly BrowserPlatformAdapter[] = [{
  platform: 'onezone',
  capabilities: { zone: true, singleSeat: true, adjacentSeats: false },
  matches: onezoneAdapter.matches,
  inspect(document, url, context) {
    const inspection = inspectOnezonePage(document, url);
    if (!context) return inspection;
    const auto = inspectAutoControls(document, inspection, context.preferences, context.progress);
    return { ...inspection, automation: { page: auto.page, execute: action => executeAutoAction(action, auto.bindings) } };
  },
}];
export const adapterForUrl = (url: URL) => adapters.find(adapter => adapter.matches(url));
export function inspectPlatform(document: Document, url: URL, context?: Parameters<BrowserPlatformAdapter['inspect']>[2]): PlatformInspection {
  return adapterForUrl(url)?.inspect(document, url, context) ?? {
    snapshot: { url: url.href, state: 'UNKNOWN', selectionMode: 'UNKNOWN', visibleOptions: [], supported: false, reason: 'Nền tảng này chưa có adapter.' }, optionElements: [],
  };
}
