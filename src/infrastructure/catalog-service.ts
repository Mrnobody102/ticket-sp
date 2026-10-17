import { createOnezoneCatalog, ONEZONE_READ_ORIGINS } from '../platforms/onezone-catalog';
import { eventUrl } from '../core/preferences';
import type { ConcertDetail, ConcertSearchResult, TicketCatalog } from '../core/catalog';
import type { Platform } from '../core/models';
import { createTicketboxCatalog, TICKETBOX_READ_ORIGIN } from '../platforms/ticketbox-catalog';

export type CatalogCommand = { type: 'CATALOG_SEARCH'; query: string; page: number; platform: Platform } |
  { type: 'CATALOG_DETAIL'; url: string; platform: Platform } | { type: 'CATALOG_TICKETS'; eventId: string; performanceId: string; platform: Platform };
export type CatalogReply = ConcertDetail | ConcertSearchResult | TicketCatalog;
const cache = new Map<string, { at: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();

async function read(url: string, format: 'json' | 'text', fresh = false): Promise<unknown> {
  const parsed = new URL(url);
  if (![...ONEZONE_READ_ORIGINS, 'https://ticket.1zone.vn', TICKETBOX_READ_ORIGIN].includes(parsed.origin)) throw new Error('Nguồn dữ liệu chưa được hỗ trợ.');
  const cached = cache.get(url);
  const ttl = url.includes('ticket-summary') ? 5000 : 60000;
  if (!fresh && cached && Date.now() - cached.at < ttl) return cached.value;
  const existing = pending.get(url); if (!fresh && existing) return existing;
  const request = (async () => {
    const response = await fetch(url, { method: 'GET', credentials: 'omit', cache: fresh ? 'no-store' : 'default', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(response.status === 429 ? 'Nguồn dữ liệu đang giới hạn truy cập. Thử lại sau.' : `Không tải được dữ liệu sự kiện (HTTP ${response.status}).`);
    const value: unknown = format === 'json' ? await response.json() : await response.text();
    if (cache.size >= 50) cache.delete(cache.keys().next().value!);
    cache.set(url, { at: Date.now(), value }); return value;
  })();
  if (fresh) return request;
  pending.set(url, request);
  try { return await request; } finally { pending.delete(url); }
}
const factories = { onezone: createOnezoneCatalog, ticketbox: createTicketboxCatalog };
const catalogs = { onezone: factories.onezone(read), ticketbox: factories.ticketbox(read) };
export function getCatalogProvider(platform: Platform, fresh = false) {
  if (platform !== 'onezone' && platform !== 'ticketbox') throw new Error('Chưa kết nối nguồn dữ liệu nền tảng này.');
  return fresh ? factories[platform]((url, format) => read(url, format, true)) : catalogs[platform];
}
export async function handleCatalogCommand(message: CatalogCommand): Promise<CatalogReply> {
  const provider = getCatalogProvider(message.platform);
  switch (message.type) {
    case 'CATALOG_SEARCH':
      if (typeof message.query !== 'string' || message.query.length > 120 || !Number.isInteger(message.page) || message.page < 1 || message.page > 100) throw new Error('Từ khóa hoặc trang không hợp lệ.');
      return provider.search(message.query.trim(), message.page);
    case 'CATALOG_DETAIL': return provider.detail(message.platform === 'onezone' ? eventUrl(message.url).href : message.url);
    case 'CATALOG_TICKETS': return provider.tickets(message.eventId, message.performanceId);
    default: throw new Error('Lệnh dữ liệu không được hỗ trợ.');
  }
}
