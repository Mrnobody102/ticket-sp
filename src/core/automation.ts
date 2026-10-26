import type { EventPreferences, PageSnapshot, VisibleOption } from './models';
import { isSameEvent, normalize } from './preferences';
import { recommend } from './workflow';

export const AUTO_PHASES = ['READY', 'OPENING', 'CHOOSING', 'QUANTITY', 'SETTING_QUANTITY', 'ADVANCING', 'CHECKOUT', 'PAUSED'] as const;
export type AutoPhase = typeof AUTO_PHASES[number];
export const AUTO_TIMING = { confirmationMs: 5000, navigationMs: 15000, runMs: 3600000,
  watchLeadMs: 120000, entryRetryMs: 1500, maxEntryAttempts: 3, rescanMs: 1000, retryCooldownMs: 1000 } as const;
/** Only adapters that prove no reservation was sent may request a new selection. */
export class SelectionUnavailableError extends Error {}
export function isAutoProgress(value: unknown): value is AutoProgress {
  if (!value || typeof value !== 'object') return false;
  const p = value as AutoProgress;
  if (!AUTO_PHASES.includes(p.phase) || typeof p.message !== 'string' || p.message.length > 500) return false;
  if (p.selectionRetries !== undefined && (!Number.isInteger(p.selectionRetries) || p.selectionRetries < 0 || p.selectionRetries > 5)) return false;
  if (p.entryAttempts !== undefined && (!Number.isInteger(p.entryAttempts) || p.entryAttempts < 1 || p.entryAttempts > AUTO_TIMING.maxEntryAttempts)) return false;
  if ([p.actionAt, p.verificationStartedAt, p.quantityAfterAction, p.selectionStartedAt, p.checkoutReachedAt, p.releaseReloadedAt, p.lastReleaseReloadAt, p.addonsContinuedAt, p.reservationAttemptedAt, p.selectionRetryUntil].some(v => v !== undefined && (typeof v !== 'number' || !Number.isFinite(v)))) return false;
  const chosen = p.chosen;
  if (chosen === undefined) return true;
  return !!chosen && typeof chosen === 'object' && (typeof chosen.label === 'string' && chosen.label.length <= 100 && ['ZONE', 'SEAT'].includes(chosen.kind) &&
    (chosen.zoneLabel === undefined || typeof chosen.zoneLabel === 'string') &&
    (chosen.seatLabels === undefined || (Array.isArray(chosen.seatLabels) && chosen.seatLabels.length > 0 && chosen.seatLabels.length <= 10 && chosen.seatLabels.every(s => typeof s === 'string' && !!s && s.length <= 100) && new Set(chosen.seatLabels).size === chosen.seatLabels.length)) &&
    (chosen.ticketTypeId === undefined || (typeof chosen.ticketTypeId === 'string' && /^[\w-]{1,100}$/.test(chosen.ticketTypeId))) &&
    (chosen.displayedPriceVnd === undefined || Number.isSafeInteger(chosen.displayedPriceVnd)));
}
export function allowsAutoTransition(from: AutoPhase, to: AutoPhase): boolean {
  if (to === 'PAUSED') return true;
  if (from === 'CHECKOUT') return false;
  if (to === 'CHECKOUT') return true;
  if (from === 'PAUSED') return false;
  const next: Record<AutoPhase, readonly AutoPhase[]> = {
    READY: ['READY', 'OPENING', 'CHOOSING', 'QUANTITY'], OPENING: ['READY', 'OPENING'], CHOOSING: ['QUANTITY', 'READY'],
    QUANTITY: ['SETTING_QUANTITY', 'ADVANCING'], SETTING_QUANTITY: ['QUANTITY'], ADVANCING: ['ADVANCING'], CHECKOUT: [], PAUSED: [],
  };
  return next[from].includes(to);
}
export interface AutoProgress {
  phase: AutoPhase;
  message: string;
  chosen?: Pick<VisibleOption, 'label' | 'kind' | 'zoneLabel' | 'displayedPriceVnd' | 'ticketTypeId' | 'seatLabels'>;
  verificationStartedAt?: number;
  actionAt?: number;
  quantityAfterAction?: number;
  selectionStartedAt?: number;
  checkoutReachedAt?: number;
  releaseReloadedAt?: number;
  lastReleaseReloadAt?: number;
  addonsContinuedAt?: number;
  selectionRetries?: number;
  entryAttempts?: number;
  reservationAttemptedAt?: number;
  selectionRetryUntil?: number;
}
export interface AutoRun {
  id: string;
  tabId: number;
  revision: number;
  preferencesKey: string;
  startedAt: number;
  expiresAt: number;
  progress: AutoProgress;
}
export interface AutoQuantity {
  value: number;
  min: number;
  max: number;
  writable: boolean;
  stepper: boolean;
}
export interface AutoPage {
  snapshot: PageSnapshot;
  enterCount: number;
  advanceCount: number;
  selectable: string[];
  quantity?: AutoQuantity;
  problem?: string;
  resumeSelection?: string;
  verificationPending?: boolean;
  verifiedAddons?: boolean;
  saleOpen?: boolean;
  selectionRetrySafe?: boolean;
  /** True only for a verified navigation CTA; never a reservation/payment control. */
  entryRetrySafe?: boolean;
  loading?: boolean;
  documentStartedAt?: number;
  selectionPending?: boolean;
}
export type AutoAction = { kind: 'ENTER' | 'ADVANCE' | 'RELOAD' } | { kind: 'CHOOSE'; optionId: string } | { kind: 'QUANTITY'; value: number };
export type AutoDecision = { type: 'WAIT'; wakeAt?: number } | { type: 'STEP'; progress: AutoProgress; action?: AutoAction };

export const preferencesKey = (p: EventPreferences) => JSON.stringify(p);
export const autoActive = (run: AutoRun | null) => !!run && !['CHECKOUT', 'PAUSED'].includes(run.progress.phase);
export const hasUnresolvedReservation = (run: AutoRun | null | undefined) => !!run && run.progress.reservationAttemptedAt !== undefined && run.progress.phase !== 'CHECKOUT';
export const autoWatching = (run: AutoRun | null) => autoActive(run) || hasUnresolvedReservation(run);
/** Only use after the adapter proves that no reservation was submitted. */
export function retryUnavailableSelection(progress: AutoProgress, now: number): AutoProgress {
  const count = (progress.selectionRetries ?? 0) + 1;
  const cooldown = count >= 5;
  return { ...progress, phase: 'READY', chosen: undefined, actionAt: undefined, selectionRetries: cooldown ? 0 : count,
    selectionRetryUntil: cooldown ? now + AUTO_TIMING.retryCooldownMs : undefined,
    message: cooldown ? 'Chờ cập nhật tình trạng khu vé.' : 'Khu vừa chọn hết vé. Đang tìm khu khác đúng ưu tiên.' };
}
export const sameOption = (a: NonNullable<AutoProgress['chosen']>, b: VisibleOption) =>
  normalize(a.label) === normalize(b.label) && a.kind === b.kind &&
  ((a.kind === 'ZONE' && a.zoneLabel === undefined) || normalize(a.zoneLabel ?? '') === normalize(b.zoneLabel ?? '')) && a.displayedPriceVnd === b.displayedPriceVnd &&
  (a.ticketTypeId === undefined || a.ticketTypeId === b.ticketTypeId) &&
  ((!a.seatLabels && !b.seatLabels) || (!!a.seatLabels && !!b.seatLabels && a.seatLabels.length === b.seatLabels.length && a.seatLabels.every(s => b.seatLabels!.includes(s))));
const pause = (progress: AutoProgress, message: string): AutoDecision => ({ type: 'STEP', progress: { ...progress, phase: 'PAUSED', message } });

/** Decide first, persist the transition, then act. No DOM/Chrome dependencies here. */
export function decideAutomation(run: AutoRun, page: AutoPage, p: EventPreferences, now: number): AutoDecision {
  const { snapshot } = page;
  const progress = run.progress;
  const wait = (wakeAt?: number): AutoDecision => ({ type: 'WAIT', wakeAt: Math.min(wakeAt ?? run.expiresAt, run.expiresAt) });
  if (!autoActive(run)) {
    if (hasUnresolvedReservation(run) && run.preferencesKey === preferencesKey(p) && snapshot.state === 'CHECKOUT' && !page.problem) {
      try {
        if (new URL(snapshot.url).origin === new URL(p.eventUrl).origin) return { type: 'STEP', progress: {
          ...progress, phase: 'CHECKOUT', checkoutReachedAt: now, message: 'Website đã chuyển tới thanh toán. Kiểm tra đơn và thanh toán.',
        } };
      } catch { /* Unrecognized URLs cannot confirm a late result. */ }
    }
    return { type: 'WAIT' };
  }
  if (run.preferencesKey !== preferencesKey(p)) return pause(progress, 'Cấu hình đã đổi. Bắt đầu lại sau khi kiểm tra.');
  if (now >= run.expiresAt) return pause(progress, 'Phiên camp đã hết thời gian. Kiểm tra trang trước khi bắt đầu lại.');
  // CHECKOUT is an internal state classified by the platform adapter from DOM
  // evidence, not a literal website label. Stop here; do not submit final payment.
  // Its route may no longer retain the event slug; this is not proof of a server hold.
  if (snapshot.state === 'CHECKOUT') return { type: 'STEP', progress: { ...progress, phase: 'CHECKOUT', message: 'Đã tới bước thanh toán. Kiểm tra đơn và thanh toán.', checkoutReachedAt: now } };
  if (page.problem) return pause(progress, page.problem);
  if (snapshot.state === 'CHALLENGE') {
    if (!page.verificationPending) return pause(progress, 'Hoàn thành xác minh trên website rồi bắt đầu lại.');
    if (progress.phase === 'ADVANCING' && progress.chosen?.seatLabels && progress.verificationStartedAt === undefined) return { type: 'STEP', progress: { ...progress, verificationStartedAt: now, message: 'Chờ xác minh.' } };
    return progress.phase === 'OPENING' ? { type: 'STEP', progress: { ...progress, phase: 'READY', message: 'Chờ xác minh trên website.' } } : wait(now + AUTO_TIMING.rescanMs);
  }
  if (progress.verificationStartedAt !== undefined && progress.phase === 'ADVANCING') return { type: 'STEP', progress: { ...progress, verificationStartedAt: undefined, actionAt: now, message: 'Đang tạo đơn…' } };
  if (snapshot.state === 'WAITING_ROOM') {
    // Admission can return to the event page, requiring a new navigation click.
    // Only an entry navigation is reset; never repeat an uncertain cart request.
    if (progress.phase === 'OPENING') return { type: 'STEP', progress: {
      ...progress, phase: 'READY', message: 'Đang xếp hàng. Chờ website cho vào.',
    } };
    return wait(now + AUTO_TIMING.rescanMs);
  }
  if (page.verifiedAddons && progress.phase === 'ADVANCING') {
    if (progress.addonsContinuedAt !== undefined) return now - progress.addonsContinuedAt < AUTO_TIMING.navigationMs
      ? wait(progress.addonsContinuedAt + AUTO_TIMING.navigationMs) : pause(progress, 'Chưa xác nhận trang thanh toán sau bước mua kèm. Không bấm lại.');
    return { type: 'STEP', action: { kind: 'ADVANCE' }, progress: { ...progress, addonsContinuedAt: now, actionAt: now, message: 'Bỏ qua mua kèm; chuyển tới thanh toán…' } };
  }
  if (!isSameEvent(snapshot.url, p.eventUrl)) {
    if (['OPENING', 'ADVANCING'].includes(progress.phase) && now - (progress.actionAt ?? 0) < AUTO_TIMING.navigationMs) return wait((progress.actionAt ?? now) + AUTO_TIMING.navigationMs);
    return pause(progress, 'URL không còn khớp concert/suất đã lưu.');
  }
  const saleAt = p.startMode === 'IMMEDIATE' ? run.startedAt : Date.parse(p.saleStartAt);
  const watchAt = p.startMode === 'WHEN_AVAILABLE' && p.refreshAtSale ? saleAt - AUTO_TIMING.watchLeadMs : saleAt;
  const early = p.startMode === 'WHEN_AVAILABLE' && (page.saleOpen === true || progress.phase !== 'READY');
  if (now < saleAt && !early && !(snapshot.state === 'NOT_READY' && now >= watchAt)) return wait(now < watchAt ? watchAt : saleAt);
  if (snapshot.maxQuantity !== undefined && p.quantity > snapshot.maxQuantity) return pause(progress, 'Số vé vượt giới hạn hiển thị của sự kiện.');
  const timedOut = (ms: number) => now - (progress.actionAt ?? now) >= ms;
  const pending = (ms: number, message: string) => timedOut(ms) ? pause(progress, message) : wait((progress.actionAt ?? now) + ms);
  if (progress.phase === 'ADVANCING') return pending(AUTO_TIMING.navigationMs, 'Chưa xác nhận đã tới checkout. Không bấm lại để tránh lặp giữ vé.');
  if (snapshot.state === 'UNKNOWN' && page.selectionPending && ['READY', 'OPENING'].includes(progress.phase)) return wait(now + AUTO_TIMING.rescanMs);
  if (progress.phase === 'OPENING') {
    if (snapshot.state === 'SELECTING') return { type: 'STEP', progress: { ...progress, phase: 'READY', message: 'Đã vào bước chọn vé.' } };
    if (page.entryRetrySafe && (progress.entryAttempts ?? 1) < AUTO_TIMING.maxEntryAttempts) {
      const next = (progress.actionAt ?? now) + AUTO_TIMING.entryRetryMs;
      if (now < next) return wait(next);
      return { type: 'STEP', action: { kind: 'ENTER' }, progress: { ...progress, entryAttempts: (progress.entryAttempts ?? 1) + 1, actionAt: now, message: 'Đang mở lại bước mua vé…' } };
    }
    if (page.entryRetrySafe && p.refreshAtSale && timedOut(AUTO_TIMING.navigationMs)) {
      return { type: 'STEP', action: { kind: 'RELOAD' }, progress: { ...progress, phase: 'READY', entryAttempts: undefined, actionAt: undefined,
        releaseReloadedAt: progress.releaseReloadedAt ?? now, lastReleaseReloadAt: now, message: 'Trang mua chưa phản hồi. Đang tải lại.' } };
    }
    if (snapshot.unsupportedVariant) return pending(AUTO_TIMING.navigationMs, snapshot.reason);
    return pending(AUTO_TIMING.navigationMs, 'Chưa vào được bước chọn vé sau khi bấm mua. Kiểm tra trang.');
  }
  if (snapshot.state === 'NOT_READY' && progress.phase === 'READY') {
    if (p.refreshAtSale) {
      // Do not interrupt the current document's scripts/assets with another F5.
      const loadingSince = Math.max(run.startedAt, progress.lastReleaseReloadAt ?? 0, page.documentStartedAt ?? 0);
      if (page.loading && now - loadingSince < AUTO_TIMING.navigationMs) return wait(now + 250);
      // Server-rendered event status can remain stale without any DOM mutation.
      // Retry only on this exact NOT_READY event, with decreasing frequency.
      const interval = now >= saleAt - 60000 && now <= saleAt + 15000 ? 1000 : now - saleAt < 30000 ? 2500 : now - saleAt < 120000 ? 5000 : 15000;
      const last = progress.lastReleaseReloadAt ?? progress.releaseReloadedAt;
      // A refresh just before sale must not push the release-time refresh into
      // the next interval. The deadline takes precedence over periodic cadence.
      const next = last === undefined ? watchAt : Math.min(last + interval, last < saleAt ? saleAt : Infinity);
      if (now < next) return wait(next);
      return { type: 'STEP', action: { kind: 'RELOAD' }, progress: { ...progress, releaseReloadedAt: progress.releaseReloadedAt ?? now, lastReleaseReloadAt: now, message: 'Trang vẫn chưa mở bán. Đang cập nhật lại.' } };
    }
    return wait();
  }
  if (snapshot.state === 'EVENT_PAGE' && progress.phase === 'READY') {
    if (page.enterCount > 1) return pause(progress, 'Có nhiều nút mua vé. Cần xác định đúng suất trước khi chạy.');
    return page.enterCount === 1 ? { type: 'STEP', action: { kind: 'ENTER' }, progress: { ...progress, phase: 'OPENING', entryAttempts: 1, message: 'Đang vào bước chọn vé…', actionAt: now } } : wait();
  }
  if (!snapshot.supported || snapshot.state !== 'SELECTING') {
    if (snapshot.state === 'UNKNOWN' && !snapshot.unsupportedVariant && !snapshot.reason.includes('UNSUPPORTED_VARIANT')) {
      const hydrationAt = Math.max(run.startedAt, progress.lastReleaseReloadAt ?? progress.releaseReloadedAt ?? 0);
      if (progress.phase === 'READY' && now < hydrationAt + AUTO_TIMING.navigationMs) return wait(hydrationAt + AUTO_TIMING.navigationMs);
      if (['CHOOSING', 'SETTING_QUANTITY'].includes(progress.phase)) return pending(AUTO_TIMING.confirmationMs, 'Giao diện chưa xác nhận thao tác chọn vé.');
    }
    return pause(progress, snapshot.reason || 'Chưa đọc được giao diện chọn vé.');
  }
  const selected = snapshot.visibleOptions.filter(o => o.selected);
  if (progress.phase === 'READY') {
    if (selected.length) {
      const existing = selected.length === 1 && selected[0];
      const permitted = existing && page.resumeSelection === existing.id && existing.kind === 'ZONE' &&
        recommend({ ...snapshot, visibleOptions: [{ ...existing, selected: false }] }, p).length === 1;
      return permitted ? { type: 'STEP', progress: { ...progress, phase: 'QUANTITY', chosen: existing, actionAt: now, message: `Kiểm tra số lượng ${existing.label}.` } }
        : pause(progress, 'Trang đã có vé/ghế được chọn. Kiểm tra giỏ trước khi camp lại.');
    }
    if (progress.selectionRetryUntil !== undefined && now < progress.selectionRetryUntil) return wait(progress.selectionRetryUntil);
    const choice = recommend(snapshot, p).find(r => page.selectable.includes(r.option.id));
    if (!choice) {
      // A sold-out preferred tier can reopen while other tiers remain on sale.
      // Relax availability only to decide to WAIT; never use it for a click.
      const waitingForStock = recommend({ ...snapshot, visibleOptions: snapshot.visibleOptions.map(o =>
        o.displayedAvailability === 'UNAVAILABLE' ? { ...o, displayedAvailability: 'AVAILABLE' } : o) }, p).length > 0;
      return waitingForStock || !snapshot.visibleOptions.some(o => o.displayedAvailability === 'AVAILABLE')
        ? wait(now + AUTO_TIMING.rescanMs)
        : pause(progress, 'Chưa có lựa chọn có thể tự chọn đúng ưu tiên, giá và số lượng.');
    }
    if (snapshot.selectionMode === 'UNKNOWN') return pause(progress, 'Chưa xác định được cách chọn vé của sự kiện.');
    if (choice.option.kind === 'ZONE' && !choice.option.seatLabels && ['PICK_SEAT', 'MIXED'].includes(snapshot.selectionMode)) return pause(progress, 'Khu này có thể cần chọn ghế; cần adapter xác nhận cách chọn trước khi tự thao tác.');
    if (snapshot.visibleOptions.filter(o => sameOption(choice.option, o)).length !== 1) return pause(progress, 'Các lựa chọn trùng nhãn/giá, chưa phân biệt được vị trí chính xác.');
    return { type: 'STEP', action: { kind: 'CHOOSE', optionId: choice.option.id }, progress: {
      ...progress, phase: 'CHOOSING', chosen: choice.option, selectionRetryUntil: undefined, message: `Đang chọn ${choice.option.label}…`, actionAt: now, selectionStartedAt: now,
    } };
  }
  if (selected.length > 1) return pause(progress, 'Website báo nhiều lựa chọn cùng được chọn. Kiểm tra giỏ trước khi tiếp tục.');
  const chosen = progress.chosen && snapshot.visibleOptions.find(o => sameOption(progress.chosen!, o));
  if (selected.some(o => !progress.chosen || !sameOption(progress.chosen, o))) return pause(progress, 'Có lựa chọn khác trong giỏ. Dừng để tránh đặt sai vé.');
  if (!chosen?.selected) {
    if (progress.phase === 'CHOOSING' && page.selectionRetrySafe && chosen?.displayedAvailability === 'UNAVAILABLE' && !selected.length) {
      return { type: 'STEP', progress: retryUnavailableSelection(progress, now) };
    }
    if (progress.phase === 'CHOOSING') return pending(AUTO_TIMING.confirmationMs, 'Website chưa xác nhận lựa chọn. Không tự bấm lại.');
    return pause(progress, 'Lựa chọn đã thay đổi hoặc chưa được website xác nhận.');
  }
  if (progress.phase === 'CHOOSING') return { type: 'STEP', progress: { ...progress, phase: 'QUANTITY', message: `Đã chọn ${chosen.label}; kiểm tra số lượng.` } };
  if (progress.phase === 'SETTING_QUANTITY') {
    if (page.quantity?.value === progress.quantityAfterAction) return { type: 'STEP', progress: { ...progress, phase: 'QUANTITY', message: 'Website đã cập nhật số lượng.' } };
    return pending(AUTO_TIMING.confirmationMs, 'Website chưa xác nhận số lượng. Kiểm tra trực tiếp.');
  }
  if (chosen.kind === 'ZONE') {
    const quantity = page.quantity;
    if (!quantity) return pause(progress, 'Chưa đọc được số lượng vé của khu đã chọn.');
    if (p.quantity < quantity.min || p.quantity > quantity.max) return pause(progress, 'Số lượng yêu cầu ngoài giới hạn của điều khiển vé.');
    if (quantity.value !== p.quantity) {
      if (!quantity.writable) return pause(progress, 'Không tìm thấy điều khiển để cập nhật số lượng.');
      const value = quantity.stepper ? quantity.value + Math.sign(p.quantity - quantity.value) : p.quantity;
      return { type: 'STEP', action: { kind: 'QUANTITY', value }, progress: { ...progress, phase: 'SETTING_QUANTITY', quantityAfterAction: value, actionAt: now, message: `Đang đặt số lượng ${p.quantity} vé…` } };
    }
  } else if (p.quantity !== 1 || selected.length !== 1) return pause(progress, 'Chưa hỗ trợ tự chọn nhóm nhiều ghế.');
  if (page.advanceCount > 1) return pause(progress, 'Có nhiều nút tiếp tục; chưa xác định chắc nút đi checkout.');
  if (!page.advanceCount) return pending(AUTO_TIMING.confirmationMs, 'Chưa có nút tiếp tục khả dụng tới checkout.');
  return { type: 'STEP', action: { kind: 'ADVANCE' }, progress: { ...progress, phase: 'ADVANCING', reservationAttemptedAt: progress.reservationAttemptedAt ?? now, actionAt: now, message: 'Đang chuyển tới bước thanh toán…' } };
}
