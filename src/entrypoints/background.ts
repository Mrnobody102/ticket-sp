import { defineBackground } from 'wxt/utils/define-background';
import type { Command } from '../infrastructure/messages';
import { CONFIG_KEY, repository } from '../infrastructure/storage';
import { eventUrl, isSameEvent, validatePreferences } from '../core/preferences';
import { reconcileReminder, SALE_ALARM } from '../infrastructure/reminders';

export default defineBackground(() => {
  // Serialize mutations in this worker; durable configuration lives in storage.
  let pending: Promise<unknown> = Promise.resolve();
  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
    const result = pending.then(task);
    pending = result.catch(() => undefined);
    return result;
  };
  const reconcile = () => { void enqueue(reconcileReminder).catch(() => undefined); };
  chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !raw || typeof raw !== 'object') return;
    const message = raw as Command;
    const extensionPage = sender.url?.startsWith(chrome.runtime.getURL('/'));
    if (!extensionPage && !['ENABLE', 'PANEL', 'OPEN_EVENT'].includes(message.type)) {
      respond({ error: 'Lệnh chỉ dùng trong trang cấu hình tiện ích.' }); return;
    }
    void enqueue(async () => {
      let config = await repository.load();
      switch (message.type) {
        case 'SAVE':
          config = { ...config, preferences: validatePreferences(message.preferences), enabled: true };
          await repository.save(config); break;
        case 'ENABLE':
          if (typeof message.enabled !== 'boolean' || (message.enabled && !config.preferences)) throw new Error('Lưu concert trước khi bật theo dõi.');
          config = { ...config, enabled: message.enabled }; await repository.save(config); break;
        case 'PANEL':
          if (typeof message.visible !== 'boolean') throw new Error('Cấu hình panel không hợp lệ.');
          config = { ...config, panelVisible: message.visible }; await repository.save(config); break;
        case 'OPEN_EVENT': {
          if (!config.preferences) throw new Error('Lưu concert trước khi mở.');
          const url = eventUrl(config.preferences.eventUrl).href;
          const tabs = await chrome.tabs.query({ url: 'https://ticket.1zone.vn/*' });
          const existing = tabs.find(t => t.url && isSameEvent(t.url, url));
          if (existing?.id !== undefined) {
            await chrome.tabs.update(existing.id, { active: true });
            if (existing.windowId !== undefined) await chrome.windows.update(existing.windowId, { focused: true });
          } else await chrome.tabs.create({ url });
          break;
        }
        case 'OPEN_DEMO': await chrome.tabs.create({ url: chrome.runtime.getURL('/demo.html') }); break;
        default: throw new Error('Lệnh không được hỗ trợ.');
      }
      await chrome.action.setBadgeText({ text: '' });
      await reconcileReminder();
      return config;
    }).then(config => respond({ config }), error => respond({ error: error instanceof Error ? error.message : 'Không thể lưu cấu hình.' }));
    return true;
  });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[CONFIG_KEY]) reconcile(); });
  chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === SALE_ALARM) reconcile(); });
  chrome.runtime.onStartup.addListener(reconcile);
  chrome.runtime.onInstalled.addListener(reconcile);
  // Reconcile on every worker evaluation as alarms may be lost across browser restarts.
  reconcile();
});
