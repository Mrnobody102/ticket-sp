import type { EventPreferences, PageSnapshot } from '../core/models';
import { platformForUrl } from '../core/platform-catalog';
import { normalize } from '../core/preferences';
import { createPageReader, isOfficialOnezoneEntry, type PageReader } from './onezone-dom';
import { readOptionElements, type OptionElement } from './onezone-options';
import { readSelectionMode } from './onezone-selection';
import { hasOnezoneVerification, readOnezoneModal } from './onezone-modal';
import { readOnezoneMap } from './onezone-map';
import { readOnezoneSeats } from './onezone-seats';
import { isOnezoneQueueFor, ONEZONE_QUEUE_ORIGIN } from './onezone-queue';

export { readOptionElements } from './onezone-options';

export interface OnezoneInspection {
  snapshot: PageSnapshot;
  optionElements: OptionElement[];
  reader: PageReader;
}

const matches = (url: URL) => platformForUrl(url.href)?.id === 'onezone';

/** Read a page once and return its snapshot together with the exact DOM bindings. */
export function inspectOnezonePage(document: Document, url: URL, p?: EventPreferences): OnezoneInspection {
  const reader = createPageReader(document);
  const base: PageSnapshot = {
    url: url.href, state: 'UNKNOWN', selectionMode: 'UNKNOWN', visibleOptions: [], supported: false,
    reason: 'Chưa đủ dấu hiệu để nhận diện giao diện. Tiếp tục thao tác trên website.',
  };
  const finish = (snapshot: PageSnapshot, optionElements: OptionElement[] = []): OnezoneInspection => ({ snapshot, optionElements, reader });
  if (!matches(url) || !document.body) return finish(base);
  const { isVisible, text: visibleText } = reader;
  const blocked = (state: 'CHALLENGE' | 'WAITING_ROOM' | 'CHECKOUT', reason: string) => finish({ ...base, state, reason });
  // Queue pages need only route/verification checks. Avoid walking their full
  // text/controls every second while waiting for admission.
  if (url.origin === ONEZONE_QUEUE_ORIGIN) {
    if (!p || !isOnezoneQueueFor(url.href, p)) return finish({ ...base, reason: 'Phòng chờ không khớp sự kiện đã lưu.' });
    if (hasOnezoneVerification(document, reader)) return blocked('CHALLENGE', 'Hoàn thành xác minh trên phòng chờ.');
    return blocked('WAITING_ROOM', 'Đang xếp hàng. Chờ website cho vào chọn vé.');
  }
  const headingTexts = [...document.querySelectorAll('h1, h2, h3, [role="heading"], [role="alert"], [role="status"]')]
    .filter(isVisible).map(e => normalize(visibleText(e)))
    .filter(t => t.length < 200 && !/huong dan|quy dinh|dieu khoan|gioi thieu/.test(t));
  const headings = headingTexts.join(' | ');
  const controls = [...document.querySelectorAll('button, a[href], input[type="submit"]')].filter(isVisible);
  const controlText = controls.map(e => normalize(e.getAttribute('aria-label') ?? visibleText(e))).join(' | ');
  const modal = p && readOnezoneModal(document, p, reader);
  const challengeFrame = hasOnezoneVerification(document, reader);
  const verifiedModal = modal && !modal.advance.matches(':disabled,[aria-disabled="true"]');
  if ((challengeFrame && !verifiedModal) || /xac minh ban la con nguoi|verify you are human|security verification|kiem tra bao mat|hoan thanh captcha/.test(headings)) {
    return blocked('CHALLENGE', 'Hoàn thành xác minh trực tiếp trên website.');
  }
  if (/phong cho|waiting room|ban dang (o |trong )?hang (doi|cho)|you are in (the |a )?queue/.test(headings)) {
    return blocked('WAITING_ROOM', 'Đang ở phòng chờ. Giữ nguyên tab và làm theo hướng dẫn của 1Zone.');
  }
  const visibleForm = [...document.querySelectorAll('form')].some(isVisible);
  // A question or description mentioning payment is not the checkout screen.
  if (headingTexts.some(t => /^(thanh toan|checkout|xac nhan don hang)$/.test(t)) &&
      (visibleForm || /thanh toan|xac nhan don hang/.test(controlText))) {
    return blocked('CHECKOUT', 'Kiểm tra vé, tổng tiền và hoàn tất thanh toán trên website.');
  }
  if (modal) return finish({ ...base, selectionMode: 'ZONE_ONLY', supported: true, state: 'SELECTING', visibleOptions: [modal.entry.option], reason: 'Đã đọc modal chọn hạng và số lượng của 1Zone.' }, [modal.entry]);
  // The live official CTA is stronger evidence than a stale sale-status heading.
  // Queue, verification, checkout and ticket modals have already taken precedence.
  if (/^\/events\/[^/]+\/?$/.test(url.pathname) && controls.filter(e => isOfficialOnezoneEntry(e, reader)).length === 1) {
    return finish({ ...base, state: 'EVENT_PAGE', supported: true, reason: 'Website đã mở nút mua vé.' });
  }
  // Read the full event description only when selection classification needs it.
  const text = normalize(visibleText(document.body));
  let selectionMode = readSelectionMode(text);
  const maxMatch = text.match(/(?:toi da|maximum|max\.)\s*0*(\d{1,3})\s*(?:ve|tickets)/);
  const maxQuantity = maxMatch ? Number(maxMatch[1]) : undefined;
  if (/chua (den gio |mo )?ban|sap mo ban|sale has not started/.test(headings + ' | ' + controlText)) {
    return finish({ ...base, selectionMode, maxQuantity, state: 'NOT_READY', supported: true, reason: 'Website hiển thị chưa mở bán.' });
  }
  const seats = p ? readOnezoneSeats(document, p, reader) : undefined;
  if (seats?.state.problem) return finish({ ...base, reason: seats.state.problem, unsupportedVariant: true });
  if (seats?.entries.length) return finish({ ...base, state: 'SELECTING', supported: true, selectionMode: 'PICK_SEAT', visibleOptions: seats.entries.map(e => e.option), reason: 'Tự chọn ghế.' }, seats.entries);
  if (seats?.state.ready && !seats.state.groups.length) return finish({ ...base, state: 'SELECTING', supported: true, selectionMode: 'PICK_SEAT', reason: seats.state.note ?? 'Chưa có ghế phù hợp. Đang chờ ghế.' });
  const mapEntries = p ? readOnezoneMap(document, p, reader) : [];
  const entries = mapEntries.length ? mapEntries : readOptionElements(document, selectionMode, reader, p?.catalog?.tickets);
  if (mapEntries.length) selectionMode = 'ZONE_ONLY';
  if (entries.length && entries.every(e => e.option.kind === 'ZONE' && p?.catalog?.tickets.some(q => q.id === e.option.ticketTypeId && q.seatMode === 'AUTO'))) selectionMode = 'ASSIGNED_SEAT';
  const details = { ...base, selectionMode, maxQuantity, visibleOptions: entries.map(e => e.option) };
  const unreadableMap = [...document.querySelectorAll('canvas, iframe')].some(isVisible);
  if (unreadableMap && (selectionMode === 'PICK_SEAT' || selectionMode === 'MIXED' || !entries.length)) {
    const seatsio = [...document.querySelectorAll('#seatio,iframe')].some(e => isVisible(e) && (e.id === 'seatio' || /seatsio\.(net|com)/i.test(e.getAttribute('src') ?? '')));
    if (seatsio) return finish({ ...details, unsupportedVariant: false, reason: seats?.state.note ?? 'Đang tải ghế.' });
    const knownContainer = p?.catalog && [...document.querySelectorAll('[id^="seatmap-container-"]')].some(e => e.id.startsWith(`seatmap-container-${p.catalog!.eventId}-`));
    return finish({ ...details, unsupportedVariant: !knownContainer, reason: knownContainer ? 'Đang chờ sơ đồ và giá vé hiển thị đầy đủ.' : 'Chưa đọc được các khu trên sơ đồ này. Chọn khu trên website; tool chỉ tiếp tục nếu xác minh được hạng và giá.' });
  }
  if (entries.length) return finish({
    ...details, state: 'SELECTING', supported: true,
    reason: 'Đã đọc được lựa chọn có giá và điều khiển hiển thị. Kiểm tra lại trước khi chọn.',
  }, entries);
  if (/^\/events\/[^/]+/.test(url.pathname) && (/mua ve|het ve|bat dau mua ve/.test(controlText) || /quy dinh|dieu khoan|gioi thieu su kien/.test(text))) {
    return finish({ ...details, state: 'EVENT_PAGE', supported: true, reason: 'Đang ở trang giới thiệu concert. Tự mở bước mua vé khi website cho phép.' });
  }
  return finish(details);
}

export const onezoneAdapter = {
  platform: 'onezone', matches,
  inspectVisiblePage: (document: Document, url: URL) => inspectOnezonePage(document, url).snapshot,
};
