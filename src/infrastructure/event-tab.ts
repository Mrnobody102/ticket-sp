import { eventUrl, isSameTaskPage } from '../core/preferences';
import { platformForUrl } from '../core/platform-catalog';

export async function openEventTab(target: string): Promise<number> {
  const url = eventUrl(target).href;
  const platform = platformForUrl(url)!;
  const patterns = [platform.integration!.origin, ...(platform.integration!.queueOrigins ?? [])].map(origin => `${origin}/*`);
  const [tabs, active] = await Promise.all([chrome.tabs.query({ url: patterns }), chrome.tabs.query({ active: true, currentWindow: true })]);
  const matches = (tab: chrome.tabs.Tab) => !!tab.url && isSameTaskPage(tab.url, { eventUrl: url });
  const matching = tabs.filter(matches);
  const existing = active.find(tab => tab.active && matches(tab)) ?? matching.find(t => t.active) ?? matching[0];
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return existing.id;
  }
  const tab = await chrome.tabs.create({ url });
  if (tab.id === undefined) throw new Error('Không mở được tab concert.');
  return tab.id;
}
