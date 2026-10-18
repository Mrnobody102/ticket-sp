import type { EventPreferences, PageSnapshot } from '../core/models';
import { platformForUrl } from '../core/platform-catalog';
import { normalize } from '../core/preferences';
import { createPageReader, type PageReader } from './onezone-dom';
import { readOptionElements, type OptionElement } from './onezone-options';
import { readSelectionMode } from './onezone-selection';
import { readOnezoneModal } from './onezone-modal';

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
  const text = normalize(visibleText(document.body));
  const headings = [...document.querySelectorAll('h1, h2, h3, [role="heading"], [role="alert"], [role="status"]')]
    .filter(isVisible).map(e => normalize(visibleText(e)))
    .filter(t => t.length < 200 && !/huong dan|quy dinh|dieu khoan|gioi thieu/.test(t)).join(' | ');
  const controls = [...document.querySelectorAll('button, a[href], input[type="submit"]')].filter(isVisible);
  const controlText = controls.map(e => normalize(e.getAttribute('aria-label') ?? visibleText(e))).join(' | ');
  const blocked = (state: 'CHALLENGE' | 'WAITING_ROOM' | 'CHECKOUT', reason: string) => finish({ ...base, state, reason });
  const challengeFrame = [...document.querySelectorAll('iframe')].some(e => isVisible(e) && /captcha|challenge/i.test(e.title));
  if (challengeFrame || /xac minh ban la con nguoi|verify you are human|security verification|kiem tra bao mat|hoan thanh captcha/.test(headings)) {
    return blocked('CHALLENGE', 'Hoàn thành xác minh trực tiếp trên website.');
  }
  if (/phong cho|waiting room|ban dang (o |trong )?hang (doi|cho)|you are in (the |a )?queue/.test(headings)) {
    return blocked('WAITING_ROOM', 'Đang ở phòng chờ. Giữ nguyên tab và làm theo hướng dẫn của 1Zone.');
  }
  const visibleForm = [...document.querySelectorAll('form')].some(isVisible);
  if (/thanh toan|checkout|xac nhan don hang/.test(headings) &&
      (visibleForm || /thanh toan|xac nhan don hang/.test(controlText))) {
    return blocked('CHECKOUT', 'Kiểm tra vé, tổng tiền và hoàn tất thanh toán trên website.');
  }
  const modal = p && readOnezoneModal(document, p, reader);
  if (modal) return finish({ ...base, selectionMode: 'ZONE_ONLY', supported: true, state: 'SELECTING', visibleOptions: [modal.entry.option], reason: 'Đã đọc modal chọn hạng và số lượng của 1Zone.' }, [modal.entry]);
  let selectionMode = readSelectionMode(text);
  const maxMatch = text.match(/(?:toi da|maximum|max\.)\s*0*(\d{1,3})\s*(?:ve|tickets)/);
  const maxQuantity = maxMatch ? Number(maxMatch[1]) : undefined;
  if (/chua (den gio |mo )?ban|sap mo ban|sale has not started/.test(headings + ' | ' + controlText)) {
    return finish({ ...base, selectionMode, maxQuantity, state: 'NOT_READY', supported: true, reason: 'Website hiển thị chưa mở bán.' });
  }
  const entries = readOptionElements(document, selectionMode, reader, p?.catalog?.tickets);
  if (entries.length && entries.every(e => e.option.kind === 'ZONE' && p?.catalog?.tickets.some(q => q.id === e.option.ticketTypeId && q.seatMode === 'AUTO'))) selectionMode = 'ASSIGNED_SEAT';
  const details = { ...base, selectionMode, maxQuantity, visibleOptions: entries.map(e => e.option) };
  const unreadableMap = [...document.querySelectorAll('canvas, iframe')].some(isVisible);
  if (unreadableMap && (selectionMode === 'PICK_SEAT' || selectionMode === 'MIXED' || !entries.length)) {
    return finish({ ...details, reason: 'UNSUPPORTED_VARIANT: sơ đồ canvas/iframe không đọc được chắc chắn. Chọn vé trực tiếp trên website.' });
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
