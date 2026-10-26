import type { Platform } from './models';

/** Domain configuration only. DOM selectors and website actions belong to adapters. */
export interface PlatformDefinition {
  id: Platform;
  name: string;
  /** Public event origin for catalog lookup, independent of a booking integration. */
  catalogOrigin?: string;
  observeOnly?: boolean;
  integration: {
    origin: string;
    queueOrigins?: readonly string[];
    queueDestination?(input: URL, eventId?: string): URL | null;
    canonicalEventUrl(input: URL): URL | null;
    isSameEvent(actual: URL, canonicalTarget: URL): boolean;
    performanceId(url: URL): string | undefined;
    withPerformance(url: URL, performanceId: string): URL;
  } | null;
}
export const PLATFORM_CATALOG: readonly PlatformDefinition[] = [
  {
    id: 'onezone', name: '1Zone', catalogOrigin: 'https://ticket.1zone.vn', integration: {
      origin: 'https://ticket.1zone.vn',
      queueOrigins: ['https://queue.1zone.vn'],
      queueDestination(input, eventId) {
        try {
          if (input.origin !== 'https://queue.1zone.vn' || input.username || input.password) return null;
          const target = new URL(input.searchParams.get('t') ?? '');
          const event = input.searchParams.get('e');
          return target.origin === 'https://ticket.1zone.vn' && !target.username && !target.password && target.pathname.startsWith('/booking/') &&
            (!eventId || !event || eventId.toLowerCase() === event.toLowerCase()) ? target : null;
        } catch { return null; }
      },
      canonicalEventUrl(input) {
        if (!/^\/(events|booking)\/[^/]+\/?$/.test(input.pathname)) return null;
        const clean = new URL(input.origin + input.pathname.replace(/^\/booking\//, '/events/').replace(/\/$/, ''));
        const performance = input.searchParams.get('calendarId');
        if (performance) clean.searchParams.set('calendarId', performance);
        return clean;
      },
      isSameEvent(actual, target) {
        const path = actual.pathname.replace(/^\/booking\//, '/events/').replace(/\/$/, '');
        return (path === target.pathname || path.startsWith(target.pathname + '/')) &&
          (!target.searchParams.has('calendarId') || actual.searchParams.get('calendarId') === target.searchParams.get('calendarId'));
      },
      performanceId: url => url.searchParams.get('calendarId') ?? undefined,
      withPerformance(url, performanceId) { const target = new URL(url); target.searchParams.set('calendarId', performanceId); return target; },
    },
  },
  { id: 'ticketbox', name: 'Ticketbox', catalogOrigin: 'https://ticketbox.vn', observeOnly: true, integration: null },
  { id: 'cticket', name: 'CTicket', integration: null },
];
export const contentMatches = PLATFORM_CATALOG.flatMap(p => p.integration ? [p.integration.origin, ...(p.integration.queueOrigins ?? [])].map(origin => `${origin}/*`) : p.observeOnly && p.catalogOrigin ? [`${p.catalogOrigin}/*`] : []);
export function platformForUrl(value: string): PlatformDefinition | undefined {
  try { const url = new URL(value); return PLATFORM_CATALOG.find(p => p.integration && [p.integration.origin, ...(p.integration.queueOrigins ?? [])].includes(url.origin)); }
  catch { return undefined; }
}
export function platformForCatalogUrl(value: string): PlatformDefinition | undefined {
  try { const url = new URL(value); return PLATFORM_CATALOG.find(p => p.catalogOrigin === url.origin); }
  catch { return undefined; }
}
