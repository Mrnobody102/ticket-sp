import type { ConcertDetail, ConcertSearchResult, TicketCatalog } from '../core/catalog';
import type { Platform } from '../core/models';
import { sendToBackground } from './extension-runtime';

async function request<T>(message: object): Promise<T> {
  const reply = await sendToBackground<{ data?: T; error?: string }>(message);
  if (!reply || reply.error || !reply.data) throw new Error(reply?.error ?? 'Không kết nối được nguồn dữ liệu sự kiện.');
  return reply.data;
}
export const catalogClient = {
  search: (query: string, page = 1, platform: Platform = 'onezone', fresh = false) => request<ConcertSearchResult>({ type: 'CATALOG_SEARCH', query, page, platform, fresh }),
  detail: (url: string, platform: Platform = 'onezone', fresh = false) => request<ConcertDetail>({ type: 'CATALOG_DETAIL', url, platform, fresh }),
  tickets: (eventId: string, performanceId: string, platform: Platform = 'onezone', fresh = false) => request<TicketCatalog>({ type: 'CATALOG_TICKETS', eventId, performanceId, platform, fresh }),
};
