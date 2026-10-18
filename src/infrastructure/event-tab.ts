import { eventUrl, isSameEvent } from '../core/preferences';

export async function openEventTab(target: string): Promise<number> {
  const url = eventUrl(target).href;
  const tabs = await chrome.tabs.query({ url: `${new URL(url).origin}/*` });
  const matching = tabs.filter(t => t.url && isSameEvent(t.url, url));
  const existing = matching.find(t => t.active) ?? matching[0];
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return existing.id;
  }
  const tab = await chrome.tabs.create({ url });
  if (tab.id === undefined) throw new Error('Không mở được tab concert.');
  return tab.id;
}
