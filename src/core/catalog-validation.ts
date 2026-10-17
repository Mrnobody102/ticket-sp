import type { ConcertDetail, TicketCatalog } from './catalog';
import type { EventPreferences } from './models';

/** Every fallback must accommodate the whole requested quantity. Unknown is not a site limit. */
export function catalogQuantityLimit(performanceMax: number | undefined, tickets: { maxQuantity?: number }[]): number | undefined {
  const known = [performanceMax, ...tickets.map(t => t.maxQuantity)].filter((v): v is number => v !== undefined);
  return known.length ? Math.min(...known) : undefined;
}

/** Preflight happens when arming, so catalog reads do not enter the selection hot path. */
export function verifyCatalogSelection(p: EventPreferences, detail: ConcertDetail, tickets: TicketCatalog, now: number): void {
  const selected = p.catalog;
  if (!selected) return;
  const performance = detail.performances.find(s => s.id === selected.performanceId);
  if (detail.id !== selected.eventId || detail.platform !== p.platform || tickets.eventId !== selected.eventId ||
      tickets.performanceId !== selected.performanceId || !performance) throw new Error('Sự kiện/suất đã thay đổi. Tải lại chi tiết và lưu lại.');
  if (detail.currency !== 'VND') throw new Error('Chưa hỗ trợ camp bằng đơn vị tiền của sự kiện này.');
  if (performance.startsAt !== selected.startsAt || performance.venue !== selected.venue) throw new Error('Ngày/địa điểm suất diễn đã đổi. Tải lại chi tiết rồi lưu lại.');
  if (performance.endsAt && Date.parse(performance.endsAt) <= now) throw new Error('Suất diễn này đã kết thúc. Chọn đúng sự kiện sắp mở bán.');
  if (performance.maxQuantity !== undefined && p.quantity > performance.maxQuantity) throw new Error('Số vé vượt giới hạn của suất.');
  for (const preference of selected.tickets) {
    const ticket = tickets.tickets.find(t => t.id === preference.id);
    if (!ticket || ticket.name !== preference.name || ticket.priceVnd !== preference.priceVnd) throw new Error('Hạng vé hoặc giá đã đổi. Tải lại danh sách hạng vé rồi lưu lại.');
    if (preference.zoneName !== undefined && ticket.zoneName !== preference.zoneName) throw new Error('Tên zone đã đổi. Tải lại hạng vé rồi lưu lại.');
    if (preference.seatMode && preference.seatMode !== ticket.seatMode) throw new Error('Cách chọn ghế đã đổi. Tải lại hạng vé rồi lưu lại.');
    if (ticket.maxQuantity !== undefined && p.quantity > ticket.maxQuantity) throw new Error(`Hạng ${ticket.name} chỉ cho phép tối đa ${ticket.maxQuantity} vé.`);
  }
}
