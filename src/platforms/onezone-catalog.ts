import type { CatalogProvider, CatalogReadResource, ConcertDetail, ConcertSearchResult, TicketCatalog } from '../core/catalog';
import { eventUrl, normalize } from '../core/preferences';

export const ONEZONE_READ_ORIGINS = ['https://marketplace.1zone.vn', 'https://prod.1zone.vn'] as const;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const id = (value: unknown) => { const result = string(value); if (!/^[\w-]{1,100}$/.test(result)) throw new Error('ID từ nguồn sự kiện không hợp lệ.'); return result; };
const price = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const count = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
function envelope(value: unknown) {
  const payload = record(value);
  if (payload.errorCode !== 0) throw new Error('Nguồn sự kiện không trả dữ liệu hợp lệ.');
  return payload.data;
}
function jsonObjectAt(text: string, start: number): unknown {
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('Thiếu dữ liệu chi tiết sự kiện.');
}

/** Parse JSON carried by public Next flight records; never evaluate website JavaScript. */
export function parseOnezoneDetail(html: string, url: string): ConcertDetail {
  const canonical = eventUrl(url);
  for (const match of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    let event: RecordValue;
    try {
      const payload: unknown = JSON.parse(match[1]!);
      if (!Array.isArray(payload) || typeof payload[1] !== 'string') continue;
      const marker = payload[1].indexOf('"eventData":');
      if (marker < 0) continue;
      event = record(jsonObjectAt(payload[1], marker + '"eventData":'.length));
    } catch { continue; }
    if (canonical.pathname !== `/events/${string(event.pathName)}` || !string(event.name)) throw new Error('Dữ liệu trả về không khớp concert đã chọn.');
    const calendars = event.eventCalendar;
    if (!Array.isArray(calendars)) throw new Error('Chưa đọc được danh sách suất diễn.');
    const performances = calendars.map(value => {
      const calendar = record(value);
      const startsAt = date(calendar.startDate);
      if (!startsAt || (calendar.eventId && calendar.eventId !== event.id)) throw new Error('Suất diễn không khớp sự kiện.');
      return { id: id(calendar.calendarId), venue: string(calendar.location) || string(event.address), startsAt,
        endsAt: date(calendar.endDate), maxQuantity: count(calendar.maxTicketPerUser),
        ...(calendars.length === 1 && event.status === 'OPEN' && event.canPurchase === true ? { saleStatus: 'OPEN' as const }
          : calendars.length === 1 && event.status === 'CLOSE' ? { saleStatus: 'CLOSED' as const } : {}) };
    });
    if (new Set(performances.map(p => p.id)).size !== performances.length) throw new Error('Danh sách suất bị trùng ID.');
    return { platform: 'onezone', id: id(event.id), title: string(event.name), url: canonical.href, venue: string(event.address),
      startsAt: performances[0]?.startsAt, imageUrl: string(event.thumbnail), status: string(event.status),
      performances, currency: string(event.currencyCode), requiresQueue: !!event.queueId };
  }
  throw new Error('Trang sự kiện chưa có dữ liệu đọc được. Có thể website đã đổi cấu trúc.');
}
export function parseOnezoneTickets(value: unknown, eventId: string, performanceId: string, now = Date.now()): TicketCatalog {
  const values = envelope(value);
  if (!Array.isArray(values)) throw new Error('Chưa đọc được hạng vé.');
  const tickets = values.filter(v => record(v).isShowInBooking !== false).map(value => {
    const ticket = record(value);
    if (ticket.eventId !== eventId || ticket.calendarId !== performanceId) throw new Error('Hạng vé thuộc sự kiện/suất khác.');
    const priceVnd = price(ticket.finalPriceVn);
    if (priceVnd === undefined || !string(ticket.name)) throw new Error('Hạng vé thiếu tên hoặc giá rõ ràng.');
    return { id: id(ticket.ticketClassId), name: string(ticket.name), priceVnd, zoneName: string(ticket.zoneName) || undefined,
      maxQuantity: count(ticket.maxTicketPerUser), available: count(ticket.availableTickets),
      seatMode: ticket.seatType === 'auto' ? 'AUTO' as const : ticket.seatType === 'manual' ? 'PICK' as const : 'UNKNOWN' as const,
      requiresChallenge: ticket.isCaptchaEnable === true };
  });
  if (new Set(tickets.map(t => t.id)).size !== tickets.length) throw new Error('Hạng vé trùng ID; chưa thể chọn chính xác.');
  const graphical = values.some(value => ['seatmap', 'seatmap_zone'].includes(string(record(value).ticketType)));
  return { eventId, performanceId, fetchedAt: now, tickets, ...(graphical ? { layout: 'SEAT_MAP' as const } : {}) };
}

/** A grouped ticket's zoneName is only one representative. Join every physical
 * zone from the separate public endpoint by ticketClassId, never by a prefix. */
export function attachOnezoneZones(value: unknown, catalog: TicketCatalog, required: readonly string[]): TicketCatalog {
  const values = envelope(value);
  if (!Array.isArray(values)) throw new Error('Chưa đọc được danh sách zone.');
  const zones = values.map(value => {
    const zone = record(value);
    if (zone.eventId !== catalog.eventId || zone.calendarId !== catalog.performanceId) throw new Error('Zone thuộc sự kiện/suất khác.');
    const name = string(zone.name);
    if (!name || name.length > 100) throw new Error('Tên zone không hợp lệ.');
    return { id: id(zone.id), name, ticketTypeId: id(zone.ticketClassId) };
  });
  if (new Set(zones.map(z => z.id)).size !== zones.length) throw new Error('Zone trùng ID.');
  const tickets = catalog.tickets.map(ticket => {
    const members = zones.filter(z => z.ticketTypeId === ticket.id).map(({ id, name }) => ({ id, name }));
    if (!members.length) {
      if (required.includes(ticket.id)) throw new Error(`Chưa có zone cho hạng ${ticket.name}. Tải lại khi website công bố sơ đồ.`);
      return ticket;
    }
    if (members.length > 500 || new Set(members.map(z => normalize(z.name))).size !== members.length) throw new Error('Tên zone bị trùng hoặc vượt giới hạn đọc.');
    return { ...ticket, zones: members };
  });
  return { ...catalog, tickets };
}

export function createOnezoneCatalog(read: CatalogReadResource): CatalogProvider {
  return {
    platform: 'onezone',
    async search(query, page) {
      const params = new URLSearchParams({ limit: '24', page: String(page) });
      const searching = !!query.trim();
      const endpoint = searching ? `https://marketplace.1zone.vn/v2/marketplace/search?${new URLSearchParams({ keyword: query.trim(), limit: '50' })}` : `https://marketplace.1zone.vn/v2/marketplace/ticket-events?${params}`;
      const data = record(envelope(await read(endpoint, 'json')));
      const values = searching ? data.ticketEvents : data.items;
      if (!Array.isArray(values)) throw new Error('Chưa đọc được danh sách sự kiện.');
      const items = values.flatMap(value => {
        const event = record(value);
        const path = string(event.path).replace(/^\/events\//, '/');
        if (!/^\/[\w-]+$/.test(path) || !string(event.name)) return [];
        return [{ platform: 'onezone' as const, id: id(event.id), title: string(event.name), url: `https://ticket.1zone.vn/events${path}`,
          venue: string(event.location), startsAt: date(event.day), priceFromVnd: price(event.price), imageUrl: string(event.imageUrl), status: string(event.status) }];
      });
      const result: ConcertSearchResult = { items,
        totalItems: searching ? items.length : count(data.totalItems) ?? items.length, page: searching ? 1 : page,
        totalPages: searching ? 1 : count(data.totalPages) ?? 1, fetchedAt: Date.now() };
      return result;
    },
    async detail(url) {
      const html = await read(eventUrl(url).href, 'text');
      if (typeof html !== 'string') throw new Error('Nội dung sự kiện không hợp lệ.');
      return parseOnezoneDetail(html, url);
    },
    async tickets(eventId, performanceId) {
      id(eventId); id(performanceId);
      const base = `https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/${eventId}`;
      const summary = await read(`${base}?type=group&calendarId=${performanceId}`, 'json');
      const catalog = parseOnezoneTickets(summary, eventId, performanceId);
      const required = (envelope(summary) as unknown[]).map(record).filter(t => (t.ticketType === 'seatmap_zone' || t.type === 'zone') && t.isShowInBooking !== false).map(t => id(t.ticketClassId));
      if (!required.length) return catalog;
      return attachOnezoneZones(await read(`${base}/zones?calendarId=${performanceId}`, 'json'), catalog, required);
    },
  };
}
