import { allowsAutoTransition, AUTO_TIMING, autoActive, isAutoProgress, preferencesKey, type AutoRun } from '../core/automation';
import { isSameEvent } from '../core/preferences';
import type { AutoCommand } from './automation-messages';
import { openEventTab } from './event-tab';
import { repository } from './storage';
import { getCatalogProvider } from './catalog-service';
import { verifyCatalogSelection } from '../core/catalog-validation';
import { ensureEventRuntime } from './event-runtime';

export const AUTO_KEY = 'ticket-assistant.auto.session.v1';
export async function readAutoRun(): Promise<AutoRun | null> {
  const value: unknown = (await chrome.storage.session.get(AUTO_KEY))[AUTO_KEY];
  if (!value || typeof value !== 'object') return null;
  const run = value as AutoRun;
  return typeof run.id === 'string' && typeof run.preferencesKey === 'string' && Number.isInteger(run.tabId) &&
    Number.isInteger(run.revision) && run.revision >= 0 && Number.isFinite(run.expiresAt) && Number.isFinite(run.startedAt) && isAutoProgress(run.progress) ? run : null;
}
async function writeAutoRun(run: AutoRun | null, previous?: AutoRun | null) {
  if (run) await chrome.storage.session.set({ [AUTO_KEY]: run });
  else await chrome.storage.session.remove(AUTO_KEY);
  const tabId = run?.tabId ?? previous?.tabId;
  if (tabId !== undefined) await chrome.tabs.sendMessage(tabId, { type: 'AUTO_UPDATED', run }).catch(() => undefined);
}
export async function stopAutoRun(): Promise<void> {
  const run = await readAutoRun();
  if (run) await writeAutoRun(null, run);
}
export async function reconcileAutoRun(): Promise<void> {
  const [run, config] = await Promise.all([readAutoRun(), repository.load()]);
  if (!run) return;
  if (!config.enabled || !config.preferences || preferencesKey(config.preferences) !== run.preferencesKey) await stopAutoRun();
}

/** Called inside the background's serialized queue. Revision checks prevent stale clicks. */
export async function handleAutoCommand(message: AutoCommand, sender: chrome.runtime.MessageSender): Promise<AutoRun | null> {
  if (sender.frameId !== undefined && sender.frameId !== 0) throw new Error('Camp chỉ chạy trong tab chính.');
  const run = await readAutoRun();
  const extensionPage = sender.url?.startsWith(chrome.runtime.getURL('/'));
  const owner = extensionPage || sender.tab?.id === run?.tabId;
  if (message.type === 'AUTO_GET') return owner ? run : null;
  if (message.type === 'AUTO_STOP') {
    if (!owner && run) throw new Error('Camp đang chạy ở tab khác.');
    await stopAutoRun(); return null;
  }
  const config = await repository.load();
  const p = config.preferences;
  if (!p) throw new Error('Lưu link concert, giờ bán và ưu tiên trước khi bắt đầu camp.');
  if (message.type === 'AUTO_START') {
    if (autoActive(run) && run!.expiresAt > Date.now()) throw new Error('Đang camp trên một tab. Dừng phiên hiện tại trước khi bắt đầu lại.');
    if (p.catalog) {
      const provider = getCatalogProvider(p.platform, true);
      const [detail, tickets] = await Promise.all([provider.detail(p.eventUrl), provider.tickets(p.catalog.eventId, p.catalog.performanceId)]);
      verifyCatalogSelection(p, detail, tickets, Date.now());
    }
    if (!extensionPage && (!sender.tab?.url || !isSameEvent(sender.tab.url, p.eventUrl))) throw new Error('Mở đúng concert/suất đã lưu trước khi bắt đầu camp.');
    const tabId = extensionPage ? await openEventTab(p.eventUrl) : sender.tab!.id!;
    if (extensionPage) await ensureEventRuntime(tabId);
    if (!config.enabled || !config.panelVisible) await repository.save({ ...config, enabled: true, panelVisible: true });
    const next: AutoRun = {
      id: crypto.randomUUID(), tabId, revision: 0, preferencesKey: preferencesKey(p), startedAt: Date.now(),
      expiresAt: Math.max(Date.now(), Date.parse(p.saleStartAt)) + AUTO_TIMING.runMs,
      progress: { phase: 'READY', message: 'Đã bật camp. Chờ giờ bán/giao diện chọn vé.' },
    };
    await writeAutoRun(next); return next;
  }
  if (message.type !== 'AUTO_STEP') throw new Error('Lệnh camp không được hỗ trợ.');
  if (!run || !owner || sender.tab?.id !== run.tabId || message.id !== run.id || message.revision !== run.revision) throw new Error('Phiên camp đã đổi hoặc thao tác cũ đã bị hủy.');
  if (!config.enabled || preferencesKey(p) !== run.preferencesKey) throw new Error('Cấu hình đã đổi hoặc camp đã dừng.');
  if (!isAutoProgress(message.progress) || !allowsAutoTransition(run.progress.phase, message.progress.phase)) throw new Error('Trạng thái hoặc chuyển bước camp không hợp lệ.');
  const next = { ...run, revision: run.revision + 1, progress: message.progress };
  await writeAutoRun(next); return next;
}
