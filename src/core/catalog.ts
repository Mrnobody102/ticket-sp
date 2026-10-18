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
  saleStatus?: 'OPEN' | 'CLOSED';
}
export interface ConcertDetail extends ConcertSummary {
  performances: Performance[];
  currency: string;
  requiresQueue?: boolean;
  requiresAttendeeForm?: boolean;
}
export interface TicketZone { id: string; name: string }
export interface TicketType {
  id: string;
  name: string;
  priceVnd: number;
  zoneName?: string;
  zones?: TicketZone[];
  maxQuantity?: number;
  minQuantity?: number;
  saleStartsAt?: string;
  saleEndsAt?: string;
  available?: number;
  seatMode: 'AUTO' | 'PICK' | 'UNKNOWN';
  requiresChallenge?: boolean;
}
export interface TicketCatalog {
  eventId: string;
  performanceId: string;
  fetchedAt: number;
  tickets: TicketType[];
  layout?: 'TICKET_TYPES' | 'SEAT_MAP' | 'UNKNOWN';
  seatMapId?: number;
  requiresQueue?: boolean;
}
export interface CatalogSelection {
  eventId: string;
  performanceId: string;
  title: string;
  venue: string;
  startsAt: string;
  verifiedAt: number;
  maxQuantity?: number;
  tickets: (Pick<TicketType, 'id' | 'name' | 'priceVnd'> & Partial<Pick<TicketType, 'seatMode' | 'maxQuantity' | 'zoneName' | 'zones'>>)[];
}
export interface LoadedConcert { detail: ConcertDetail; performance: Performance; catalog: TicketCatalog }
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
