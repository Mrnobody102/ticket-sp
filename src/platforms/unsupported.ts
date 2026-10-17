import type { PlatformAdapter, Platform } from '../core/models';

export const unsupportedAdapter = (platform: Exclude<Platform, 'onezone'>): PlatformAdapter => ({
  platform,
  matches: () => false,
  inspectVisiblePage: (_document, url) => ({
    url: url.href, state: 'UNKNOWN', selectionMode: 'UNKNOWN', visibleOptions: [], supported: false,
    reason: `${platform} chưa được hỗ trợ trong MVP.`,
  }),
});

export const ticketboxAdapter = unsupportedAdapter('ticketbox');
export const cticketAdapter = unsupportedAdapter('cticket');
