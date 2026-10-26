import type { PlatformInspection } from './contracts';
import type { PageSnapshot } from '../core/models';
import { normalize } from '../core/preferences';
import { createPageReader } from './onezone-dom';

/** Observation only until the authenticated cart/seat contract is verified.
 * Never reuse 1Zone controls, infer coordinates, submit a form or reserve seats. */
export function inspectTicketboxPage(document: Document, url: URL): PlatformInspection {
  const reader = createPageReader(document);
  const base: PageSnapshot = { url: url.href, state: 'UNKNOWN', supported: false, selectionMode: 'UNKNOWN', visibleOptions: [], reason: 'Ticketbox: chỉ nhận diện và lưu báo cáo; chưa bật tự mua.' };
  const finish = (patch: Partial<PageSnapshot> = {}) => ({ snapshot: { ...base, ...patch }, optionElements: [] });
  if (url.origin !== 'https://ticketbox.vn' || url.username || url.password || !document.body) return finish();
  const visible = (selector: string) => [...document.querySelectorAll(selector)].filter(reader.isVisible);
  const headings = visible('h1,h2,h3,[role="heading"],[role="alert"]').map(e => normalize(reader.text(e))).filter(t => t.length < 200).join(' | ');
  if (visible('input[type="password"]').length || /dang nhap|sign in/.test(headings)) return finish({ reason: 'Đăng nhập Ticketbox trên website. Tool không đọc tài khoản hoặc mật khẩu.' });
  if (visible('iframe').some(e => /captcha|challenge/i.test(e.getAttribute('title') + ' ' + e.getAttribute('src'))) || /xac minh nguoi dung|xac minh ban la|verify you are human|chong bot/.test(headings)) return finish({ state: 'CHALLENGE', reason: 'Hoàn thành xác minh trên Ticketbox.' });
  if (/^\/(queue|waiting-room)\/\d+\/?$/.test(url.pathname) || /ban dang (o |trong )?hang cho|waiting queue|waiting room/.test(headings)) return finish({ state: 'WAITING_ROOM', reason: 'Đang xếp hàng Ticketbox. Giữ nguyên tab; website tự cập nhật lượt.' });
  if (/^\/events\/\d+\/bookings\/\d+\/payment-info\/?$/.test(url.pathname)) return finish({ state: 'CHECKOUT', reason: 'Đã tới trang thanh toán Ticketbox. Kiểm tra giỏ và tổng tiền trên website.' });
  if (/^\/events\/\d+\/bookings\/\d+\/question-form\/?$/.test(url.pathname)) return finish({ reason: 'Điền biểu mẫu bắt buộc của sự kiện trên Ticketbox. Không tự điền hoặc đồng ý thay bạn.' });
  if (/^\/events\/\d+\/bookings\/\d+\/select-ticket\/?$/.test(url.pathname)) {
    const map = visible('canvas,iframe,[id*="seatmap"],[class*="seatmap"],svg [data-seat-id],svg [data-zone-id]').length > 0;
    return finish({ state: 'SELECTING', unsupportedVariant: true,
      reason: map ? 'Đã nhận diện sơ đồ Ticketbox. Chưa xác minh bộ chọn ghế này; thao tác trên website.' : 'Đang chọn hạng và số vé Ticketbox. Chưa bật tự mua cho luồng này.' });
  }
  if (/^\/[\w-]+-\d+\/?$/.test(url.pathname)) return finish({ state: 'EVENT_PAGE' });
  return finish();
}
