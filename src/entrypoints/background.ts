import { defineBackground } from 'wxt/utils/define-background';
import type { Command } from '../infrastructure/messages';
import { CONFIG_KEY, repository } from '../infrastructure/storage';
import { validatePreferences } from '../core/preferences';
import { reconcileReminder, SALE_ALARM } from '../infrastructure/reminders';
import type { AutoCommand } from '../infrastructure/automation-messages';
import { handleAutoCommand, readAutoRun, reconcileAutoRun, stopAutoRun } from '../infrastructure/automation-service';
import { openEventTab } from '../infrastructure/event-tab';

export default defineBackground(() => {
  // Serialize mutations in this worker; durable configuration lives in storage.
  let pending: Promise<unknown> = Promise.resolve();
  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
    const result = pending.then(task);
    pending = result.catch(() => undefined);
    return result;
  };
  const reconcile = () => { void enqueue(async () => { await reconcileAutoRun(); await reconcileReminder(); }).catch(() => undefined); };
  chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !raw || typeof raw !== 'object') return;
    const message = raw as Command | AutoCommand;
    if (typeof message.type !== 'string') return;
    if (message.type.startsWith('AUTO_')) {
      void enqueue(() => handleAutoCommand(message as AutoCommand, sender)).then(run => respond({ run }), error => respond({ error: error instanceof Error ? error.message : 'Không thực hiện được camp.' }));
      return true;
    }
    const command = message as Command;
    const extensionPage = sender.url?.startsWith(chrome.runtime.getURL('/'));
    if (!extensionPage && !['ENABLE', 'PANEL', 'OPEN_EVENT'].includes(message.type)) {
      respond({ error: 'Lệnh chỉ dùng trong trang cấu hình tiện ích.' }); return;
    }
    void enqueue(async () => {
      let config = await repository.load();
      switch (command.type) {
        case 'SAVE':
          config = { ...config, preferences: validatePreferences(command.preferences), enabled: true };
          await stopAutoRun();
          await repository.save(config); break;
        case 'ENABLE':
          if (typeof command.enabled !== 'boolean' || (command.enabled && !config.preferences)) throw new Error('Lưu concert trước khi bật theo dõi.');
          if (!command.enabled) await stopAutoRun();
          config = { ...config, enabled: command.enabled }; await repository.save(config); break;
        case 'PANEL':
          if (typeof command.visible !== 'boolean') throw new Error('Cấu hình panel không hợp lệ.');
          config = { ...config, panelVisible: command.visible }; await repository.save(config); break;
        case 'OPEN_EVENT': {
          if (!config.preferences) throw new Error('Lưu concert trước khi mở.');
          await openEventTab(config.preferences.eventUrl);
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
  chrome.tabs.onRemoved.addListener(tabId => { void enqueue(async () => { if ((await readAutoRun())?.tabId === tabId) await stopAutoRun(); }).catch(() => undefined); });
  // Reconcile on every worker evaluation as alarms may be lost across browser restarts.
  reconcile();
});
