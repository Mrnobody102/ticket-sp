import type { TaskConfig } from '../core/models';
import { reminderIsDue, reminderKey } from '../core/workflow';
import { NOTIFIED_KEY, repository } from './storage';

export const SALE_ALARM = 'ticket-assistant.sale';

export async function reconcileReminder(): Promise<void> {
  const config = await repository.load();
  if (!config.enabled || !config.preferences || config.preferences.startMode === 'IMMEDIATE') { await chrome.alarms.clear(SALE_ALARM); return; }
  const at = Date.parse(config.preferences.saleStartAt);
  if (at > Date.now()) { await chrome.alarms.create(SALE_ALARM, { when: at }); return; }
  await chrome.alarms.clear(SALE_ALARM);
  await notifyDue(config);
}

export async function notifyDue(config: TaskConfig): Promise<void> {
  const stored = await chrome.storage.local.get(NOTIFIED_KEY);
  if (!reminderIsDue(config, stored[NOTIFIED_KEY], Date.now()) || !config.preferences) return;
  // Persist before showing: worker restarts cannot produce duplicate notifications.
  await chrome.storage.local.set({ [NOTIFIED_KEY]: reminderKey(config.preferences) });
  try {
    await chrome.notifications.create('ticket-assistant-sale', {
      type: 'basic', iconUrl: chrome.runtime.getURL('/icon-128.png'),
      title: 'Đã đến giờ mở bán bạn đặt',
      message: 'Mở tab concert và kiểm tra thông báo chính thức của 1Zone. Giờ nhắc theo đồng hồ máy.',
    });
  } catch {
    // OS notifications may be disabled. The panel countdown remains available.
    await chrome.action.setBadgeText({ text: 'GIỜ' });
  }
}
