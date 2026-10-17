import type { Platform } from './models';

/** Domain configuration only. DOM selectors and website actions belong to adapters. */
export interface PlatformDefinition {
  id: Platform;
  name: string;
  integration: {
    origin: string;
    canonicalEventUrl(input: URL): URL | null;
    isSameEvent(actual: URL, canonicalTarget: URL): boolean;
  } | null;
}
export const PLATFORM_CATALOG: readonly PlatformDefinition[] = [
  {
    id: 'onezone', name: '1Zone', integration: {
      origin: 'https://ticket.1zone.vn',
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
    },
  },
  { id: 'ticketbox', name: 'Ticketbox', integration: null },
  { id: 'cticket', name: 'CTicket', integration: null },
];
export const contentMatches = PLATFORM_CATALOG.flatMap(p => p.integration ? [`${p.integration.origin}/*`] : []);
export function platformForUrl(value: string): PlatformDefinition | undefined {
  try { const url = new URL(value); return PLATFORM_CATALOG.find(p => p.integration?.origin === url.origin); }
  catch { return undefined; }
}
