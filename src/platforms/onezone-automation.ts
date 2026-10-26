import type { AutoAction, AutoPage, AutoProgress, AutoQuantity } from '../core/automation';
import { sameOption } from '../core/automation';
import { isSameEvent, normalize } from '../core/preferences';
import type { EventPreferences } from '../core/models';
import type { OnezoneInspection } from './onezone';
import { isOfficialOnezoneEntry, ONEZONE_BUY_LABEL, type PageReader } from './onezone-dom';
import { hasOnezoneVerification, readOnezoneModal } from './onezone-modal';
import { chooseOnezoneMap, hasMapChoice } from './onezone-map';
import { chooseOnezoneSeats, hasSeatsChoice, readSeatsContinue, readSeatsState } from './onezone-seats';
import { readOnezoneAddons } from './onezone-addons';
import { isOnezoneQueueFor } from './onezone-queue';
import { documentBootPending } from './document-readiness';

interface QuantityBinding {
  model: AutoQuantity;
  element: HTMLInputElement | HTMLSelectElement | HTMLElement;
  increase?: HTMLElement;
  decrease?: HTMLElement;
}
export interface AutoBindings {
  enter: Element[];
  advance: Element[];
  choices: Map<string, Element>;
  quantity?: QuantityBinding;
  reader: PageReader;
  reload(): void;
  chooseMap?(element: Element, optionId: string): void;
  chooseSeats?(element: Element, optionId: string): void;
}
export interface AutoInspection { page: AutoPage; bindings: AutoBindings }

const buyLabel = ONEZONE_BUY_LABEL;
const selectLabel = /^(chon|chon ve|chon khu vuc|chon ghe|select|select tickets?)$/;
// "Thanh toán" / "Xác nhận đơn hàng" are deliberately not navigation commands.
const nextLabel = /^(tiep tuc|tiep tuc dat ve|tiep tuc mua ve|mua ve|dat ve|den buoc thanh toan|tiep tuc den thanh toan|continue|proceed to checkout)$/;
const quantityLabel = /so (luong|ve)|quantity|ticket count/;
const enabled = (e: Element, reader: PageReader) => reader.isVisible(e) &&
  !e.matches(':disabled, [aria-disabled="true"], [readonly], [aria-readonly="true"]') && !e.closest('[aria-disabled="true"], [inert]');

function label(element: Element, reader: PageReader): string {
  return normalize(element.getAttribute('aria-label') ??
    (element.tagName === 'INPUT' ? (element as HTMLInputElement).value : reader.name(element)));
}
function safeLink(element: Element, p: EventPreferences, enter: boolean): boolean {
  if (!element.matches('a[href]')) return true;
  const link = element as HTMLAnchorElement;
  if (link.target && link.target !== '_self') return false;
  try {
    const url = new URL(link.href);
    return url.origin === new URL(p.eventUrl).origin &&
      (enter || /^\/booking\//.test(url.pathname)
        ? /^\/booking\//.test(url.pathname) && isSameEvent(url.href, p.eventUrl)
        : /^\/checkout(?:\/|$)/.test(url.pathname));
  } catch { return false; }
}
function findQuantity(document: Document, scope: Element | undefined, reader: PageReader): QuantityBinding | undefined {
  const selector = 'input[type="number"], select, [role="spinbutton"][aria-valuenow]';
  const named = (e: Element) => {
    const ids = (e.getAttribute('aria-labelledby') ?? '').split(/\s+/);
    const names = [e.getAttribute('aria-label') ?? '', ...ids.map(id => document.getElementById(id)).filter(e => e && reader.isVisible(e)).map(e => reader.text(e!))];
    if (e.matches('input, select')) names.push(...[...((e as HTMLInputElement).labels ?? [])].filter(reader.isVisible).map(reader.text));
    return quantityLabel.test(normalize(names.join(' ')));
  };
  const scoped = scope ? [...scope.querySelectorAll(selector)].filter(reader.isVisible) : [];
  const candidates = scoped.length ? scoped : [...document.querySelectorAll(selector)].filter(reader.isVisible).filter(named);
  if (candidates.length !== 1) return undefined;
  const element = candidates[0]! as QuantityBinding['element'];
  const native = element.matches('input[type="number"], select');
  const rawValue = native ? (element as HTMLInputElement).value : element.getAttribute('aria-valuenow');
  if (rawValue === null || !rawValue.trim()) return undefined;
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 0) return undefined;
  const bound = (name: string, fallback: number) => {
    const raw = element.getAttribute(native ? name : `aria-value${name}`);
    return raw?.trim() && Number.isSafeInteger(Number(raw)) ? Number(raw) : fallback;
  };
  const model: AutoQuantity = { value, min: bound('min', 0), max: bound('max', 100), writable: !!enabled(element, reader), stepper: !native };
  if (native) return { element, model };
  const group = element.closest('[role="group"]') ?? element.parentElement;
  const buttons = [...group?.querySelectorAll('button') ?? []].filter(e => enabled(e, reader));
  const plus = buttons.filter(e => /^(tang|tang so luong|increase|increase quantity|\+)$/.test(label(e, reader)));
  const minus = buttons.filter(e => /^(giam|giam so luong|decrease|decrease quantity|-|−)$/.test(label(e, reader)));
  return { element, model: { ...model, writable: model.writable && (plus.length === 1 || minus.length === 1) }, increase: plus.length === 1 ? plus[0] : undefined, decrease: minus.length === 1 ? minus[0] : undefined };
}

/** Bind only controls whose meaning is visible. No coordinates or private booking API. */
export function inspectAutoControls(document: Document, inspection: OnezoneInspection, p: EventPreferences, progress: AutoProgress): AutoInspection {
  const { reader, snapshot, optionElements } = inspection;
  const controls = [...document.querySelectorAll<HTMLElement>('button, a[href], input[type="submit"], [role="button"]')].filter(e => enabled(e, reader));
  const candidates = controls.filter(e => buyLabel.test(label(e, reader)) && safeLink(e, p, true));
  // The official hero CTA identifies the event action; the sticky copy has no data-id.
  const officialEnter = candidates.filter(e => isOfficialOnezoneEntry(e, reader));
  const enter = officialEnter.length === 1 && isSameEvent(snapshot.url, p.eventUrl) ? officialEnter : candidates;
  const advance = controls.filter(e => nextLabel.test(label(e, reader)) && safeLink(e, p, false) && !optionElements.some(entry => entry.element.contains(e)));
  const addons = readOnezoneAddons(document, new URL(snapshot.url), p, progress, reader);
  if (addons) advance.splice(0, advance.length, addons);
  const choices = new Map<string, Element>();
  for (const { element, option } of optionElements) {
    if (hasSeatsChoice(element, option.id)) { choices.set(option.id, element); continue; }
    if (hasMapChoice(element, option.id)) { choices.set(option.id, element); continue; }
    if (element.matches('button, [role="button"], [role="option"], [role="radio"]') && enabled(element, reader)) {
      choices.set(option.id, element); continue;
    }
    const related = [...element.querySelectorAll<HTMLElement>('button, input[type="radio"], [role="option"], [role="radio"]')]
      .filter(e => enabled(e, reader) && (e.matches('input[type="radio"], [role="radio"], [role="option"]') || selectLabel.test(label(e, reader)) || buyLabel.test(label(e, reader))));
    if (related.length === 1) choices.set(option.id, related[0]!);
  }
  const chosen = progress.chosen && optionElements.find(entry => sameOption(progress.chosen!, entry.option));
  let quantity = findQuantity(document, chosen?.element, reader);
  const seatsState = readSeatsState(document);
  const seatChoice = optionElements.find(e => e.option.selected && e.option.seatLabels?.length);
  const seatAdvance = seatChoice && readSeatsContinue(document, optionElements, p, reader);
  if (seatChoice) {
    const value = seatChoice.option.seatLabels!.length;
    quantity = { element: seatChoice.element as HTMLElement, model: { value, min: value, max: value, writable: false, stepper: false } };
    advance.splice(0, advance.length, ...(seatAdvance && enabled(seatAdvance, reader) ? [seatAdvance] : []));
  }
  const modal = readOnezoneModal(document, p, reader);
  const invalidModal = !modal && !addons && !seatChoice && [...document.querySelectorAll('button[data-id="btn-continue"]')].some(reader.isVisible);
  if (modal) {
    quantity = { element: modal.valueElement, model: modal.quantity, increase: modal.increase, decrease: modal.decrease };
    advance.splice(0, advance.length, ...(enabled(modal.advance, reader) ? [modal.advance] : []));
  }
  const headings = [...document.querySelectorAll('h1,h2,h3,[role="alert"]')].filter(reader.isVisible).map(e => normalize(reader.text(e))).filter(t => t.length < 200).join(' | ');
  const password = [...document.querySelectorAll('input[type="password"]')].some(reader.isVisible);
  const problem = invalidModal ? 'Chưa xác minh được hạng, khu hoặc giá trong hộp chọn vé. Kiểm tra trực tiếp trước khi tiếp tục.'
    : password || /(?:^|\|\s*)(dang nhap|login|sign in)(\s*\||$)/.test(headings)
    ? 'Đăng nhập trên website rồi bắt đầu camp lại.'
    : /het thoi gian (giu cho|dat ve)|phien (dat ve )?(da )?het han|reservation expired|khong the giu ve|khong the giu cho/.test(headings)
      ? 'Phiên giữ chỗ đã hết hạn hoặc giữ vé thất bại. Kiểm tra trên website.' : undefined;
  return { page: { snapshot, enterCount: enter.length, advanceCount: advance.length, selectable: [...choices.keys()], quantity: quantity?.model, problem,
    loading: snapshot.state === 'NOT_READY' && documentBootPending(document),
    documentStartedAt: document.defaultView?.performance.timeOrigin,
    selectionPending: snapshot.state === 'UNKNOWN' && snapshot.unsupportedVariant === false,
    entryRetrySafe: snapshot.state === 'EVENT_PAGE' && officialEnter.length === 1 && document.readyState === 'complete' && isSameEvent(snapshot.url, p.eventUrl),
    saleOpen: (snapshot.state === 'EVENT_PAGE' && officialEnter.length === 1 && isSameEvent(snapshot.url, p.eventUrl)) ||
      (snapshot.state === 'SELECTING' && snapshot.supported && (choices.size > 0 || !!modal)),
    selectionRetrySafe: !modal && (optionElements.some(entry => hasMapChoice(entry.element, entry.option.id)) || seatsState?.retrySafe === true),
    ...(addons ? { verifiedAddons: true } : {}),
    ...(modal ? { resumeSelection: modal.entry.option.id } : {}),
    verificationPending: (!!progress.chosen?.seatLabels && progress.phase === 'ADVANCING' && snapshot.state === 'CHALLENGE' && isSameEvent(snapshot.url, p.eventUrl) && hasOnezoneVerification(document, reader)) ||
      (!!modal && hasOnezoneVerification(document, reader) && !enabled(modal.advance, reader)) ||
      (snapshot.state === 'CHALLENGE' && isOnezoneQueueFor(snapshot.url, p)) },
    bindings: { enter, advance, choices, quantity, reader, reload: () => document.defaultView!.location.reload(), chooseMap: (element, optionId) => chooseOnezoneMap(element, optionId, p), chooseSeats: (element, optionId) => chooseOnezoneSeats(element, optionId, p) } };
}

export function executeAutoAction(action: AutoAction, bindings: AutoBindings): void {
  if (action.kind === 'RELOAD') { bindings.reload(); return; }
  const target = action.kind === 'ENTER' ? bindings.enter[0] : action.kind === 'ADVANCE' ? bindings.advance[0] :
    action.kind === 'CHOOSE' ? bindings.choices.get(action.optionId) : undefined;
  if (action.kind === 'CHOOSE' && target && hasSeatsChoice(target, action.optionId)) {
    if (!bindings.chooseSeats) throw new Error('Đang kết nối sơ đồ ghế.');
    bindings.chooseSeats(target, action.optionId); return;
  }
  if (action.kind === 'CHOOSE' && target && hasMapChoice(target, action.optionId)) {
    if (!bindings.chooseMap) throw new Error('Chưa kết nối được sơ đồ khu vực.');
    bindings.chooseMap(target, action.optionId); return;
  }
  if (action.kind !== 'QUANTITY') {
    if (!target?.isConnected || !enabled(target, bindings.reader)) throw new Error('Điều khiển đã thay đổi trước khi bấm.');
    // SVGElement has no .click(). Dispatch the same bubbling click to a semantic
    // SVG control; never infer coordinates or invent a target from an image.
    const view = target.ownerDocument.defaultView!;
    if (target instanceof view.HTMLElement) target.click();
    else target.dispatchEvent(new view.MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    return;
  }
  const quantity = bindings.quantity;
  if (!quantity?.element.isConnected || !enabled(quantity.element, bindings.reader)) throw new Error('Điều khiển số lượng không còn khả dụng.');
  if (quantity.model.stepper) {
    const button = action.value > quantity.model.value ? quantity.increase : quantity.decrease;
    if (!button || !enabled(button, bindings.reader)) throw new Error('Nút tăng/giảm số lượng không khả dụng.');
    button.click(); return;
  }
  const element = quantity.element as HTMLInputElement | HTMLSelectElement;
  if (element.tagName === 'SELECT' && ![...(element as HTMLSelectElement).options].some(o => o.value === String(action.value) && !o.disabled)) throw new Error('Số lượng này không có trong lựa chọn website.');
  const view = element.ownerDocument.defaultView!;
  const prototype = element.tagName === 'SELECT' ? view.HTMLSelectElement.prototype : view.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!setter) throw new Error('Không cập nhật được số lượng.');
  setter.call(element, String(action.value));
  element.dispatchEvent(new view.Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new view.Event('change', { bubbles: true, composed: true }));
}
