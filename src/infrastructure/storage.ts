import type { ConfigRepository, TaskConfig } from '../core/models';
import { parseStoredConfig } from '../core/preferences';

export const CONFIG_KEY = 'ticket-assistant.config.v1';
export const NOTIFIED_KEY = 'ticket-assistant.notified.v1';
export const repository: ConfigRepository = {
  async load() { return parseStoredConfig((await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY]); },
  async save(config: TaskConfig) { await chrome.storage.local.set({ [CONFIG_KEY]: config }); },
};

export function watchConfig(callback: (config: TaskConfig) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[CONFIG_KEY]) callback(parseStoredConfig(changes[CONFIG_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
