import type { EventPreferences, PageSnapshot, VisibleOption } from './models';
import { isSameEvent, normalize } from './preferences';
import { recommend } from './workflow';

export const AUTO_PHASES = ['READY', 'OPENING', 'CHOOSING', 'QUANTITY', 'SETTING_QUANTITY', 'ADVANCING', 'CHECKOUT', 'PAUSED'] as const;
export type AutoPhase = typeof AUTO_PHASES[number];
export const AUTO_TIMING = { confirmationMs: 5000, navigationMs: 15000, runMs: 3600000 } as const;
export function isAutoProgress(value: unknown): value is AutoProgress {
  if (!value || typeof value !== 'object') return false;
  const p = value as AutoProgress;
  if (!AUTO_PHASES.includes(p.phase) || typeof p.message !== 'string' || p.message.length > 500) return false;
  if ([p.actionAt, p.quantityAfterAction, p.selectionStartedAt, p.checkoutReachedAt].some(v => v !== undefined && (typeof v !== 'number' || !Number.isFinite(v)))) return false;
  const chosen = p.chosen;
  if (chosen === undefined) return true;
  return !!chosen && typeof chosen === 'object' && (typeof chosen.label === 'string' && chosen.label.length <= 100 && ['ZONE', 'SEAT'].includes(chosen.kind) &&
    (chosen.zoneLabel === undefined || typeof chosen.zoneLabel === 'string') &&
    (chosen.ticketTypeId === undefined || (typeof chosen.ticketTypeId === 'string' && /^[\w-]{1,100}$/.test(chosen.ticketTypeId))) &&
    (chosen.displayedPriceVnd === undefined || Number.isSafeInteger(chosen.displayedPriceVnd)));
}
export function allowsAutoTransition(from: AutoPhase, to: AutoPhase): boolean {
  if (to === 'PAUSED') return true;
  if (from === 'PAUSED' || from === 'CHECKOUT') return false;
  if (to === 'CHECKOUT') return true;
  const next: Record<AutoPhase, readonly AutoPhase[]> = {
    READY: ['OPENING', 'CHOOSING'], OPENING: ['READY'], CHOOSING: ['QUANTITY'],
    QUANTITY: ['SETTING_QUANTITY', 'ADVANCING'], SETTING_QUANTITY: ['QUANTITY'], ADVANCING: [], CHECKOUT: [], PAUSED: [],
  };
  return next[from].includes(to);
}
export interface AutoProgress {
  phase: AutoPhase;
  message: string;
  chosen?: Pick<VisibleOption, 'label' | 'kind' | 'zoneLabel' | 'displayedPriceVnd' | 'ticketTypeId'>;
  actionAt?: number;
  quantityAfterAction?: number;
  selectionStartedAt?: number;
  checkoutReachedAt?: number;
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
}
export type AutoAction = { kind: 'ENTER' | 'ADVANCE' } | { kind: 'CHOOSE'; optionId: string } | { kind: 'QUANTITY'; value: number };
export type AutoDecision = { type: 'WAIT'; wakeAt?: number } | { type: 'STEP'; progress: AutoProgress; action?: AutoAction };

export const preferencesKey = (p: EventPreferences) => JSON.stringify(p);
export const autoActive = (run: AutoRun | null) => !!run && !['CHECKOUT', 'PAUSED'].includes(run.progress.phase);
export const sameOption = (a: NonNullable<AutoProgress['chosen']>, b: VisibleOption) =>
  normalize(a.label) === normalize(b.label) && a.kind === b.kind && normalize(a.zoneLabel ?? '') === normalize(b.zoneLabel ?? '') && a.displayedPriceVnd === b.displayedPriceVnd &&
  (a.ticketTypeId === undefined || a.ticketTypeId === b.ticketTypeId);
const pause = (progress: AutoProgress, message: string): AutoDecision => ({ type: 'STEP', progress: { ...progress, phase: 'PAUSED', message } });

/** Decide first, persist the transition, then act. No DOM/Chrome dependencies here. */
export function decideAutomation(run: AutoRun, page: AutoPage, p: EventPreferences, now: number): AutoDecision {
  const { snapshot } = page;
  const progress = run.progress;
  const wait = (wakeAt?: number): AutoDecision => ({ type: 'WAIT', wakeAt: Math.min(wakeAt ?? run.expiresAt, run.expiresAt) });
  if (!autoActive(run)) return { type: 'WAIT' };
  if (run.preferencesKey !== preferencesKey(p)) return pause(progress, 'Cấu hình đã đổi. Bắt đầu lại sau khi kiểm tra.');
  if (now >= run.expiresAt) return pause(progress, 'Phiên camp đã hết thời gian. Kiểm tra trang trước khi bắt đầu lại.');
  // Checkout is the destination, including a route that no longer retains the event slug.
  if (snapshot.state === 'CHECKOUT') return { type: 'STEP', progress: { ...progress, phase: 'CHECKOUT', message: 'Đã tới bước thanh toán. Kiểm tra đơn và thanh toán.', checkoutReachedAt: now } };
  if (page.problem) return pause(progress, page.problem);
  if (snapshot.state === 'CHALLENGE') return pause(progress, 'Hoàn thành xác minh trên website rồi bắt đầu lại.');
  if (snapshot.state === 'WAITING_ROOM') return wait();
  if (!isSameEvent(snapshot.url, p.eventUrl)) {
    if (['OPENING', 'ADVANCING'].includes(progress.phase) && now - (progress.actionAt ?? 0) < AUTO_TIMING.navigationMs) return wait((progress.actionAt ?? now) + AUTO_TIMING.navigationMs);
    return pause(progress, 'URL không còn khớp concert/suất đã lưu.');
  }
  const saleAt = Date.parse(p.saleStartAt);
  if (now < saleAt) return wait(saleAt);
  if (snapshot.maxQuantity !== undefined && p.quantity > snapshot.maxQuantity) return pause(progress, 'Số vé vượt giới hạn hiển thị của sự kiện.');
  const timedOut = (ms: number) => now - (progress.actionAt ?? now) >= ms;
  const pending = (ms: number, message: string) => timedOut(ms) ? pause(progress, message) : wait((progress.actionAt ?? now) + ms);
  if (progress.phase === 'ADVANCING') return pending(AUTO_TIMING.navigationMs, 'Chưa xác nhận đã tới checkout. Không bấm lại để tránh lặp giữ vé.');
  if (progress.phase === 'OPENING') {
    if (snapshot.state === 'SELECTING') return { type: 'STEP', progress: { ...progress, phase: 'READY', message: 'Đã vào bước chọn vé.' } };
    return pending(AUTO_TIMING.navigationMs, 'Chưa vào được bước chọn vé sau khi bấm mua. Kiểm tra trang.');
  }
  if (snapshot.state === 'NOT_READY' && progress.phase === 'READY') return wait();
  if (snapshot.state === 'EVENT_PAGE' && progress.phase === 'READY') {
    if (page.enterCount > 1) return pause(progress, 'Có nhiều nút mua vé. Cần xác định đúng suất trước khi chạy.');
    return page.enterCount === 1 ? { type: 'STEP', action: { kind: 'ENTER' }, progress: { phase: 'OPENING', message: 'Đang vào bước chọn vé…', actionAt: now } } : wait();
  }
  if (!snapshot.supported || snapshot.state !== 'SELECTING') {
    if (snapshot.state === 'UNKNOWN' && !snapshot.reason.includes('UNSUPPORTED_VARIANT')) {
      if (progress.phase === 'READY' && now < run.startedAt + AUTO_TIMING.navigationMs) return wait(run.startedAt + AUTO_TIMING.navigationMs);
      if (['CHOOSING', 'SETTING_QUANTITY'].includes(progress.phase)) return pending(AUTO_TIMING.confirmationMs, 'Giao diện chưa xác nhận thao tác chọn vé.');
    }
    return pause(progress, snapshot.reason || 'Chưa đọc được giao diện chọn vé.');
  }
  const selected = snapshot.visibleOptions.filter(o => o.selected);
  if (progress.phase === 'READY') {
    if (selected.length) return pause(progress, 'Trang đã có vé/ghế được chọn. Kiểm tra giỏ trước khi camp lại.');
    const choice = recommend(snapshot, p).find(r => page.selectable.includes(r.option.id));
    if (!choice) return snapshot.visibleOptions.some(o => o.displayedAvailability === 'AVAILABLE')
      ? pause(progress, 'Chưa có lựa chọn có thể tự chọn đúng ưu tiên, giá và số lượng.') : wait();
    if (snapshot.selectionMode === 'UNKNOWN') return pause(progress, 'Chưa xác định được cách chọn vé của sự kiện.');
    if (choice.option.kind === 'ZONE' && ['PICK_SEAT', 'MIXED'].includes(snapshot.selectionMode)) return pause(progress, 'Khu này có thể cần chọn ghế; cần adapter xác nhận cách chọn trước khi tự thao tác.');
    if (snapshot.visibleOptions.filter(o => sameOption(choice.option, o)).length !== 1) return pause(progress, 'Các lựa chọn trùng nhãn/giá, chưa phân biệt được vị trí chính xác.');
    return { type: 'STEP', action: { kind: 'CHOOSE', optionId: choice.option.id }, progress: {
      phase: 'CHOOSING', chosen: choice.option, message: `Đang chọn ${choice.option.label}…`, actionAt: now, selectionStartedAt: now,
    } };
  }
  const chosen = progress.chosen && snapshot.visibleOptions.find(o => sameOption(progress.chosen!, o));
  if (selected.some(o => !progress.chosen || !sameOption(progress.chosen, o))) return pause(progress, 'Có lựa chọn khác trong giỏ. Dừng để tránh đặt sai vé.');
  if (!chosen?.selected) {
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
  return { type: 'STEP', action: { kind: 'ADVANCE' }, progress: { ...progress, phase: 'ADVANCING', actionAt: now, message: 'Đang chuyển tới bước thanh toán…' } };
}
