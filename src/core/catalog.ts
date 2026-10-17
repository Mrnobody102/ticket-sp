import type { Platform } from './models';

export interface ConcertSummary {
  platform: Platform;
  id: string;
  title: string;
  url: string;
  venue: string;
  startsAt?: string;
  priceFromVnd?: number;
  imageUrl?: string;
  status: string;
}
export interface Performance {
  id: string;
  venue: string;
  startsAt: string;
  endsAt?: string;
  maxQuantity?: number;
}
export interface ConcertDetail extends ConcertSummary {
  performances: Performance[];
  currency: string;
  requiresQueue?: boolean;
}
export interface TicketType {
  id: string;
  name: string;
  priceVnd: number;
  zoneName?: string;
  maxQuantity?: number;
  available?: number;
  seatMode: 'AUTO' | 'PICK' | 'UNKNOWN';
  requiresChallenge?: boolean;
}
export interface TicketCatalog {
  eventId: string;
  performanceId: string;
  fetchedAt: number;
  tickets: TicketType[];
}
export interface CatalogSelection {
  eventId: string;
  performanceId: string;
  title: string;
  venue: string;
  startsAt: string;
  verifiedAt: number;
  maxQuantity?: number;
  tickets: (Pick<TicketType, 'id' | 'name' | 'priceVnd'> & Partial<Pick<TicketType, 'seatMode' | 'maxQuantity' | 'zoneName'>>)[];
}
export interface ConcertSearchResult {
  items: ConcertSummary[];
  totalItems: number;
  page: number;
  totalPages: number;
  fetchedAt: number;
}
export interface CatalogProvider {
  platform: Platform;
  search(query: string, page: number): Promise<ConcertSearchResult>;
  detail(url: string): Promise<ConcertDetail>;
  tickets(eventId: string, performanceId: string): Promise<TicketCatalog>;
}

/** Read-only transport supplied by infrastructure; providers never use browser credentials. */
export type CatalogReadResource = (url: string, format: 'json' | 'text') => Promise<unknown>;
