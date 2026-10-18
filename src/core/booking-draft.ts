import type { CatalogSelection, ConcertDetail, ConcertSearchResult, LoadedConcert, TicketCatalog } from './catalog';
import { DEFAULT_QUANTITY, type Platform } from './models';
import { validatePreferences } from './preferences';
import { platformForUrl } from './platform-catalog';

export interface FinderDraft {
  query: string;
  platform: Platform;
  result: ConcertSearchResult | null;
  showResults: boolean;
  detail: ConcertDetail | null;
  performanceId: string;
  tickets: TicketCatalog | null;
}
export interface BookingDraft {
  url: string;
  saleTime: string;
  immediate: boolean;
  strictSchedule?: boolean;
  quantity: string;
  budget: string;
  labels: string;
  alternatives: boolean;
  refreshAtSale: boolean;
  manualMode: boolean;
  loaded: LoadedConcert | null;
  selectedTickets: string[];
  retainedCatalog?: CatalogSelection;
  finder: FinderDraft;
}
export const emptyFinder = (): FinderDraft => ({ query: '', platform: 'onezone', result: null, showResults: true, detail: null, performanceId: '', tickets: null });
export const emptyBookingDraft = (): BookingDraft => ({ url: '', saleTime: '', immediate: false, quantity: String(DEFAULT_QUANTITY), budget: '', labels: '',
  strictSchedule: false, alternatives: false, refreshAtSale: true, manualMode: false, loaded: null, selectedTickets: [], finder: emptyFinder() });

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const short = (value: unknown, max = 500): value is string => typeof value === 'string' && value.length <= max;
function isDetail(value: unknown): boolean {
  return object(value) && short(value.id) && short(value.title) && short(value.url, 2000) && short(value.venue) &&
    ['onezone', 'ticketbox', 'cticket'].includes(String(value.platform)) && Array.isArray(value.performances) && value.performances.length <= 500 &&
    value.performances.every(p => object(p) && short(p.id) && short(p.venue) && short(p.startsAt));
}
function isTickets(value: unknown): boolean {
  return object(value) && short(value.eventId) && short(value.performanceId) && Number.isFinite(value.fetchedAt) &&
    Array.isArray(value.tickets) && value.tickets.length <= 1000 && value.tickets.every(t => object(t) && short(t.id) && short(t.name) && Number.isSafeInteger(t.priceVnd));
}
/** A partial form is allowed; it never becomes active preferences until SAVE validates it. */
export function parseBookingDraft(value: unknown, baseKey: string): { form: BookingDraft; dirty: boolean } | null {
  try {
    if (!object(value) || value.schemaVersion !== 1 || value.baseKey !== baseKey || typeof value.dirty !== 'boolean' || !object(value.form) || JSON.stringify(value).length > 2000000) return null;
    const f = value.form;
    if (f.strictSchedule !== undefined && typeof f.strictSchedule !== 'boolean') return null;
    if (!short(f.url, 2000) || !short(f.saleTime, 32) || !short(f.quantity, 5) || !short(f.budget, 30) || !short(f.labels, 4000) ||
      ['immediate', 'alternatives', 'refreshAtSale', 'manualMode'].some(k => typeof f[k] !== 'boolean') ||
      !Array.isArray(f.selectedTickets) || f.selectedTickets.length > 20 || f.selectedTickets.some(id => !short(id, 100))) return null;
    if (f.retainedCatalog !== undefined) validatePreferences({ platform: platformForUrl(f.url)?.id, eventUrl: f.url, saleStartAt: '2026-01-01T00:00:00Z', quantity: 1,
      preferredZoneLabels: [], allowAlternatives: false, catalog: f.retainedCatalog });
    if (f.loaded !== null && (!object(f.loaded) || !isDetail(f.loaded.detail) || !object(f.loaded.performance) ||
      !short(f.loaded.performance.id) || !short(f.loaded.performance.venue) || !short(f.loaded.performance.startsAt) || !isTickets(f.loaded.catalog))) return null;
    const finder = f.finder;
    if (!object(finder) || !short(finder.query, 500) || !['onezone', 'ticketbox', 'cticket'].includes(String(finder.platform)) ||
      typeof finder.showResults !== 'boolean' || !short(finder.performanceId) || (finder.detail !== null && !isDetail(finder.detail)) ||
      (finder.tickets !== null && !isTickets(finder.tickets))) return null;
    if (finder.result !== null && (!object(finder.result) || !Array.isArray(finder.result.items) || finder.result.items.length > 1000 ||
      finder.result.items.some(item => !object(item) || !short(item.id) || !short(item.title) || !short(item.url, 2000) || !short(item.venue)) ||
      !Number.isFinite(finder.result.page) || !Number.isFinite(finder.result.totalPages))) return null;
    return { form: f as unknown as BookingDraft, dirty: value.dirty };
  } catch { return null; }
}
