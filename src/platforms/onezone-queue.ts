import type { EventPreferences } from '../core/models';
import { isSameTaskPage } from '../core/preferences';

export const ONEZONE_QUEUE_ORIGIN = 'https://queue.1zone.vn';
/** Match only the destination and event. Never retain, replay or inspect queue tokens. */
export function isOnezoneQueueFor(actual: string, p: Pick<EventPreferences, 'platform' | 'eventUrl' | 'catalog'>): boolean {
  try {
    const queue = new URL(actual);
    return p.platform === 'onezone' && queue.origin === ONEZONE_QUEUE_ORIGIN && isSameTaskPage(actual, p);
  } catch { return false; }
}
