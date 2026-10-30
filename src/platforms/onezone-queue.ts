import type { EventPreferences } from '../core/models';
import { isSameTaskPage, normalize } from '../core/preferences';
import type { PageReader } from './onezone-dom';

export const ONEZONE_QUEUE_ORIGIN = 'https://queue.1zone.vn';
/** Queue-it softblock uses a native checkbox, not a CAPTCHA iframe. Read only. */
export function hasOnezoneQueueVerification(document: Document, reader: PageReader): boolean {
  return [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][aria-label]')].some(input =>
    !input.checked && reader.isVisible(input) && ['xac nhan rang ban la con nguoi', 'verify you are human', 'i am not a robot'].includes(normalize(input.getAttribute('aria-label')!)));
}
/** Match only the destination and event. Never retain, replay or inspect queue tokens. */
export function isOnezoneQueueFor(actual: string, p: Pick<EventPreferences, 'platform' | 'eventUrl' | 'catalog'>): boolean {
  try {
    const queue = new URL(actual);
    return p.platform === 'onezone' && queue.origin === ONEZONE_QUEUE_ORIGIN && isSameTaskPage(actual, p);
  } catch { return false; }
}
