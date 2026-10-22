import { allowsAutoTransition, AUTO_TIMING, autoActive, hasUnresolvedReservation, isAutoProgress, preferencesKey, type AutoRun } from '../core/automation';
import { isSameTaskPage } from '../core/preferences';
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
export async function ensureNoUnresolvedReservation(current?: AutoRun | null): Promise<void> {
  if (hasUnresolvedReservation(current === undefined ? await readAutoRun() : current)) throw new Error('Lượt trước đã gửi giữ vé nhưng chưa rõ kết quả. Kiểm tra tab vé trước; tắt công cụ chỉ dừng thao tác, không hủy đơn.');
}
/** Chrome can replace a WebContents/tab ID while restoring a discarded tab. */
export async function replaceAutoRunTab(addedTabId: number, removedTabId: number): Promise<void> {
  const [run, config] = await Promise.all([readAutoRun(), repository.load()]);
  if (!run || run.tabId !== removedTabId || !config.preferences) return;
  const tab = await chrome.tabs.get(addedTabId);
  const url = tab.url ?? tab.pendingUrl;
  const sameTask = !!url && isSameTaskPage(url, config.preferences);
  // A checkout route may have lost its slug; replacement still must preserve
  // the unresolved reservation and must never restart selection.
  const finishing = (hasUnresolvedReservation(run) || run.progress.phase === 'CHECKOUT') && !!url && new URL(url).origin === new URL(config.preferences.eventUrl).origin;
  await writeAutoRun({ ...run, tabId: addedTabId, revision: run.revision + 1,
    progress: sameTask || finishing ? run.progress : { ...run.progress, phase: 'PAUSED', message: 'Tab thay thế không còn đúng sự kiện đã lưu.' } });
}
export async function reconcileAutoRun(): Promise<void> {
  const [run, config] = await Promise.all([readAutoRun(), repository.load()]);
  if (!run) return;
  if (!config.enabled || !config.preferences || preferencesKey(config.preferences) !== run.preferencesKey) await stopAutoRun();
  else if (autoActive(run) && run.expiresAt <= Date.now()) await writeAutoRun({ ...run, revision: run.revision + 1,
    progress: { ...run.progress, phase: 'PAUSED', message: 'Phiên camp đã hết thời gian.' } });
}

/** Called inside the background's serialized queue. Revision checks prevent stale clicks. */
export async function handleAutoCommand(message: AutoCommand, sender: chrome.runtime.MessageSender): Promise<AutoRun | null> {
  if (sender.frameId !== undefined && sender.frameId !== 0) throw new Error('Camp chỉ chạy trong tab chính.');
  const run = await readAutoRun();
  const extensionPage = sender.url?.startsWith(chrome.runtime.getURL('/'));
  const owner = extensionPage || sender.tab?.id === run?.tabId;
  if (message.type === 'AUTO_FOCUS') {
    if (!extensionPage || !run) throw new Error('Không có tab camp để mở.');
    const tab = await chrome.tabs.update(run.tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true }); return run;
  }
  if (message.type === 'AUTO_GET') return owner ? run : null;
  if (message.type === 'AUTO_STOP') {
    if (!owner && run) throw new Error('Camp đang chạy ở tab khác.');
    await stopAutoRun(); return null;
  }
  const config = await repository.load();
  const p = config.preferences;
  if (!p) throw new Error('Lưu link concert, giờ bán và ưu tiên trước khi bắt đầu camp.');
  if (message.type === 'AUTO_START' || message.type === 'AUTO_START_HERE') {
    await ensureNoUnresolvedReservation(run);
    const startHere = message.type === 'AUTO_START_HERE';
    const senderMatches = !!sender.tab?.url && isSameTaskPage(sender.tab.url, p);
    if (startHere && (extensionPage || !senderMatches)) throw new Error('Chỉ chuyển camp từ đúng tab sự kiện hoặc phòng chờ.');
    if (autoActive(run) && run!.expiresAt > Date.now()) {
      if (!startHere || run!.tabId === sender.tab?.id) throw new Error('Đang camp trên một tab. Dừng phiên hiện tại trước khi bắt đầu lại.');
      if (!['READY', 'OPENING'].includes(run!.progress.phase) || run!.progress.chosen || run!.preferencesKey !== preferencesKey(p)) throw new Error('Tab cũ đang xử lý chọn hoặc giữ vé. Kiểm tra tab đó trước khi chuyển.');
      const transferred: AutoRun = { ...run!, id: crypto.randomUUID(), tabId: sender.tab!.id!, revision: 0,
        progress: { ...run!.progress, phase: 'READY', actionAt: undefined, message: 'Camp đã chuyển sang tab này.' } };
      // Invalidate the old runner before the new owner can execute a step.
      await chrome.tabs.sendMessage(run!.tabId, { type: 'AUTO_UPDATED', run: null }).catch(() => undefined);
      await writeAutoRun(transferred); return transferred;
    }
    if (p.catalog) {
      const provider = getCatalogProvider(p.platform, true);
      const [detail, tickets] = await Promise.all([provider.detail(p.eventUrl), provider.tickets(p.catalog.eventId, p.catalog.performanceId)]);
      verifyCatalogSelection(p, detail, tickets, Date.now());
    }
    if (!extensionPage && !senderMatches) throw new Error('Mở đúng concert/suất đã lưu trước khi bắt đầu camp.');
    const tabId = extensionPage ? await openEventTab(p.eventUrl) : sender.tab!.id!;
    if (extensionPage) await ensureEventRuntime(tabId);
    if (!config.enabled || !config.panelVisible) await repository.save({ ...config, enabled: true, panelVisible: true });
    const next: AutoRun = {
      id: crypto.randomUUID(), tabId, revision: 0, preferencesKey: preferencesKey(p), startedAt: Date.now(),
      expiresAt: Math.max(Date.now(), p.startMode === 'IMMEDIATE' ? 0 : Date.parse(p.saleStartAt)) + AUTO_TIMING.runMs,
      progress: { phase: 'READY', message: 'Đã bật camp. Chờ giờ bán/giao diện chọn vé.' },
    };
    await writeAutoRun(next); return next;
  }
  if (message.type !== 'AUTO_STEP') throw new Error('Lệnh camp không được hỗ trợ.');
  if (!run || !owner || sender.tab?.id !== run.tabId || message.id !== run.id || message.revision !== run.revision) throw new Error('Phiên camp đã đổi hoặc thao tác cũ đã bị hủy.');
  if (!config.enabled || preferencesKey(p) !== run.preferencesKey) throw new Error('Cấu hình đã đổi hoặc camp đã dừng.');
  if (!isAutoProgress(message.progress) || !allowsAutoTransition(run.progress.phase, message.progress.phase)) throw new Error('Trạng thái hoặc chuyển bước camp không hợp lệ.');
  if (run.progress.reservationAttemptedAt !== undefined && message.progress.reservationAttemptedAt !== run.progress.reservationAttemptedAt) throw new Error('Không được bỏ dấu yêu cầu giữ vé đã gửi.');
  const next = { ...run, revision: run.revision + 1, progress: message.progress };
  await writeAutoRun(next); return next;
}
