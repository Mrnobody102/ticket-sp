import type { ConcertDetail, ConcertSearchResult, TicketCatalog } from '../core/catalog';
import type { Platform } from '../core/models';

async function request<T>(message: object): Promise<T> {
  const reply = await chrome.runtime.sendMessage(message) as { data?: T; error?: string } | undefined;
  if (!reply || reply.error || !reply.data) throw new Error(reply?.error ?? 'Không kết nối được nguồn dữ liệu sự kiện.');
  return reply.data;
}
export const catalogClient = {
  search: (query: string, page = 1, platform: Platform = 'onezone') => request<ConcertSearchResult>({ type: 'CATALOG_SEARCH', query, page, platform }),
  detail: (url: string, platform: Platform = 'onezone') => request<ConcertDetail>({ type: 'CATALOG_DETAIL', url, platform }),
  tickets: (eventId: string, performanceId: string, platform: Platform = 'onezone') => request<TicketCatalog>({ type: 'CATALOG_TICKETS', eventId, performanceId, platform }),
};
