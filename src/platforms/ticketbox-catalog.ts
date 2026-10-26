import type { CatalogProvider, CatalogReadResource, ConcertDetail, ConcertSummary, TicketCatalog } from '../core/catalog';
import { normalize } from '../core/preferences';

export const TICKETBOX_READ_ORIGIN = 'https://api-v2.ticketbox.vn';
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const number = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
function body(value: unknown, kind: 'search' | 'detail' = 'search') {
  const data = record(value);
  if (kind === 'search' ? data.code !== 200 : data.status !== 1) throw new Error('Ticketbox chưa trả dữ liệu hợp lệ.');
  return record(data.data);
}
function eventId(url: string): string {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/[\w-]+-(\d+)\/?$/) ?? parsed.pathname.match(/^\/events\/(\d+)\/bookings\/[1-9]\d{0,15}\/(?:select-ticket|question-form|payment-info)\/?$/);
  if (parsed.origin !== 'https://ticketbox.vn' || parsed.username || parsed.password || !match) throw new Error('Link Ticketbox không hợp lệ.');
  return match[1]!;
}
function iso(v: unknown) {
  if (!text(v) || !Number.isFinite(Date.parse(text(v)))) throw new Error('Ngày sự kiện Ticketbox không hợp lệ.');
  return new Date(text(v)).toISOString();
}
const positiveId = (v: unknown) => { if (number(v) === undefined || v === 0) throw new Error('ID Ticketbox không hợp lệ.'); return String(v); };
const optionalDate = (value: unknown) => value === undefined || value === null || value === '' ? undefined : iso(value);
export function createTicketboxCatalog(read: CatalogReadResource): CatalogProvider {
  const comingSoon = async (): Promise<ConcertSummary[]> => {
    const data = body(await read(`${TICKETBOX_READ_ORIGIN}/gin/api/v2/discovery/onsale-sections/coming-soon`, 'json'), 'detail');
    if (!Array.isArray(data.results)) throw new Error('Chưa đọc được mục sắp mở bán Ticketbox.');
    return data.results.flatMap(value => {
      const item = record(value);
      try {
        const url = new URL(text(item.deeplink)), id = eventId(url.href);
        if (String(item.id) !== id || !text(item.name) || item.saleStage !== 'coming_soon') return [];
        url.search = ''; url.hash = '';
        // Announcement cards aren't a published showing or an authoritative ticket price.
        return [{ platform: 'ticketbox' as const, id, title: text(item.name), url: url.href,
          venue: text(record(item.city).vi), imageUrl: text(item.imageUrl), status: 'COMING_SOON' }];
      } catch { return []; }
    });
  };
  const detailData = async (id: string) => {
    if (!/^\d{1,16}$/.test(id)) throw new Error('ID Ticketbox không hợp lệ.');
    return record(body(await read(`${TICKETBOX_READ_ORIGIN}/gin/api/v2/events/${id}`, 'json'), 'detail').result);
  };
  return {
    platform: 'ticketbox',
    async search(query, page) {
      const params = new URLSearchParams({ q: query, filter: 'upcoming', page: String(page), limit: '8' });
      const [response, announcements] = await Promise.all([
        read(`${TICKETBOX_READ_ORIGIN}/search/v3/events?${params}`, 'json'),
        page === 1 ? comingSoon().catch(() => []) : Promise.resolve([]),
      ]);
      const data = body(response);
      if (!Array.isArray(data.results)) throw new Error('Không đọc được kết quả tìm Ticketbox.');
      const items = data.results.flatMap(value => {
        const item = record(value);
        try {
          const url = new URL(text(item.deeplink)); const id = eventId(url.href);
          url.search = ''; url.hash = '';
          if (String(item.id) !== id || !text(item.name)) return [];
          return [{ platform: 'ticketbox' as const, id, title: text(item.name), url: url.href, venue: '', startsAt: iso(item.day),
            priceFromVnd: number(item.price), imageUrl: text(item.imageUrl), status: 'UPCOMING' }];
        } catch { return []; }
      });
      const total = number(record(data.total).filtered) ?? items.length;
      const words = normalize(query).split(' ').filter(Boolean);
      const added = announcements.filter(item => !items.some(existing => existing.id === item.id) && words.every(word => normalize(item.title).includes(word)));
      return { items: [...added, ...items], page, totalItems: total + added.length,
        totalPages: Math.max(1, Math.ceil(total / 8)), fetchedAt: Date.now() };
    },
    async detail(url): Promise<ConcertDetail> {
      const id = eventId(url);
      let data: Record<string, unknown>;
      try { data = await detailData(id); }
      catch (error) {
        if (new URL(url).pathname.startsWith('/events/')) throw error;
        const announcement = (await comingSoon().catch(() => [])).find(item => item.id === id);
        if (!announcement) throw error;
        return { ...announcement, currency: 'VND', performances: [] };
      }
      if (String(data.id) !== id || !Array.isArray(data.showings)) throw new Error('Chi tiết Ticketbox không khớp sự kiện.');
      const explicitShowing = new URL(url).pathname.match(/^\/events\/\d+\/bookings\/([1-9]\d{0,15})\//)?.[1];
      if (explicitShowing && !data.showings.some(value => String(record(value).id) === explicitShowing)) throw new Error('Suất trong link không thuộc sự kiện Ticketbox.');
      return { platform: 'ticketbox', id, title: text(data.title), url: new URL(url).origin + new URL(url).pathname,
        venue: [text(data.venue), text(data.address)].filter(Boolean).join(', '), startsAt: iso(data.startTime),
        priceFromVnd: number(data.minTicketPrice), imageUrl: text(data.bannerURL), status: text(data.status), currency: 'VND', requiresAttendeeForm: data.isFormIncluded === true,
        performances: data.showings.flatMap(value => { const show = record(value); if (show.id === 0) return [];
          return [{ id: positiveId(show.id), venue: text(data.venue), startsAt: iso(show.startTime), endsAt: optionalDate(show.endTime),
            ...(show.isSalable === true && show.status === 'book_now' && data.isBookingAllowed === true ? { saleStatus: 'OPEN' as const }
              : show.isSalable === false ? { saleStatus: 'CLOSED' as const } : {}) }]; }) };
    },
    async tickets(eventId, performanceId): Promise<TicketCatalog> {
      if (!/^\d{1,16}$/.test(eventId) || !/^[1-9]\d{0,15}$/.test(performanceId)) throw new Error('ID suất Ticketbox không hợp lệ.');
      // Public showing endpoint is authoritative for this performance, unlike the
      // event summary cached across all showings. This remains an anonymous GET.
      const show = record(body(await read(`${TICKETBOX_READ_ORIGIN}/gin/api/v2/events/showings/${performanceId}`, 'json'), 'detail').result);
      // The live endpoint can emit eventId=0 while event.id carries the real ID.
      // Zero is a placeholder, never evidence; every nonzero identity must agree.
      const identities = [show.eventId, record(show.event).id].filter(id => id !== undefined && id !== 0);
      if (String(show.id) !== performanceId || !identities.length || identities.some(id => positiveId(id) !== eventId)) throw new Error('Hạng vé Ticketbox không khớp sự kiện/suất.');
      if (!Array.isArray(show.ticketTypes)) throw new Error('Không tìm thấy hạng vé của suất Ticketbox.');
      if (!show.ticketTypes.length && Array.isArray(show.ticketTypeGroups) && show.ticketTypeGroups.length) throw new Error('Suất này có nhóm vé cần bộ đọc riêng. Xem trên Ticketbox.');
      const mapId = number(show.seatMapId);
      const tickets = show.ticketTypes.map(value => {
        const ticket = record(value), priceVnd = number(ticket.price);
        if (priceVnd === undefined || !text(ticket.name)) throw new Error('Hạng vé Ticketbox thiếu ID/giá.');
        const minQuantity = number(ticket.minQtyPerOrder), maxQuantity = number(ticket.maxQtyPerOrder);
        if (minQuantity !== undefined && maxQuantity !== undefined && minQuantity > maxQuantity) throw new Error('Giới hạn số vé Ticketbox mâu thuẫn.');
        return { id: positiveId(ticket.id), name: text(ticket.name), priceVnd, maxQuantity, minQuantity,
          saleStartsAt: optionalDate(ticket.startTime), saleEndsAt: optionalDate(ticket.endTime), available: ['sold_out', 'sale_closed'].includes(text(ticket.status)) ? 0 : undefined,
          seatMode: mapId === 0 ? 'AUTO' as const : 'UNKNOWN' as const };
      });
      if (new Set(tickets.map(t => t.id)).size !== tickets.length) throw new Error('Hạng vé Ticketbox trùng ID.');
      return { eventId, performanceId, fetchedAt: Date.now(), tickets, layout: mapId === undefined ? 'UNKNOWN' : mapId > 0 ? 'SEAT_MAP' : 'TICKET_TYPES', seatMapId: mapId, requiresQueue: show.isEnabledQueueWaiting === true };
    },
  };
}
