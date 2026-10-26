import { AUTO_PHASES, type AutoPhase } from './automation';
import type { WorkflowState } from './models';

export const JOURNAL_LIMIT = 200;
export interface CampJournalEntry {
  at: number;
  kind: 'START' | 'STOP' | 'STEP' | 'PAGE' | 'ACTION' | 'ACTION_ERROR' | 'ORDER';
  phase?: AutoPhase;
  state?: WorkflowState;
  action?: 'ENTER' | 'CHOOSE' | 'QUANTITY' | 'ADVANCE' | 'RELOAD';
  url?: string;
  optionCount?: number;
  selectedCount?: number;
  quantity?: number;
  elapsedMs?: number;
  httpStatus?: number;
  resultCode?: number;
  code?: 'SDK_LOADING' | 'SDK_NO_STOCK' | 'SDK_ERROR' | 'PRICE_UNVERIFIED' | 'LOGIN' | 'VERIFICATION' | 'QUEUE' | 'CHECKOUT' | 'UNSUPPORTED_MAP' | 'SELECTION_UNAVAILABLE' | 'ACTION_FAILED' | 'PAGE_READ_FAILED' | 'ORDER_SENT' | 'ORDER_ACCEPTED' | 'ORDER_REJECTED' | 'ORDER_UNKNOWN';
}
export interface CampJournal { runId: string; startedAt: number; entries: CampJournalEntry[] }
const states: WorkflowState[] = ['NOT_READY', 'WAITING_ROOM', 'EVENT_PAGE', 'SELECTING', 'CHECKOUT', 'CHALLENGE', 'UNKNOWN', 'STOPPED'];
const kinds = ['START', 'STOP', 'STEP', 'PAGE', 'ACTION', 'ACTION_ERROR', 'ORDER'];
const actions = ['ENTER', 'CHOOSE', 'QUANTITY', 'ADVANCE', 'RELOAD'];
const codes = ['SDK_LOADING', 'SDK_NO_STOCK', 'SDK_ERROR', 'PRICE_UNVERIFIED', 'LOGIN', 'VERIFICATION', 'QUEUE', 'CHECKOUT', 'UNSUPPORTED_MAP', 'SELECTION_UNAVAILABLE', 'ACTION_FAILED', 'PAGE_READ_FAILED', 'ORDER_SENT', 'ORDER_ACCEPTED', 'ORDER_REJECTED', 'ORDER_UNKNOWN'];

/** Whitelist routing fields. Never copy query strings, checkout/order IDs or text. */
export function diagnosticUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const u = new URL(value);
    if (u.username || u.password || !['https://ticket.1zone.vn', 'https://queue.1zone.vn', 'https://ticketbox.vn'].includes(u.origin)) return;
    if (u.hostname === 'queue.1zone.vn') return u.origin + (u.pathname === '/softblock/' ? '/softblock/' : '/');
    const route = u.pathname.match(/^\/(?:events|booking)\/[\w-]+\/?$/);
    const ticketbox = u.hostname === 'ticketbox.vn' && (/^\/[\w-]+-\d+\/?$/.test(u.pathname) || /^\/(?:queue|waiting-room)\/\d+\/?$/.test(u.pathname) || /^\/events\/\d+\/bookings\/\d+\/(?:select-ticket|question-form|payment-info)\/?$/.test(u.pathname));
    if (route || ticketbox) {
      const calendar = u.searchParams.get('calendarId');
      return u.origin + u.pathname + (calendar && /^[\w-]{1,100}$/.test(calendar) ? '?calendarId=' + encodeURIComponent(calendar) : '');
    }
    // Unknown paths can contain personal/order identifiers. Keep origin only.
    return u.origin + '/';
  } catch { return; }
}

export function journalEntry(value: unknown, now = Date.now()): CampJournalEntry | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as CampJournalEntry;
  if (!kinds.includes(v.kind)) return;
  const result: CampJournalEntry = { at: now, kind: v.kind };
  if (AUTO_PHASES.includes(v.phase!)) result.phase = v.phase;
  if (states.includes(v.state!)) result.state = v.state;
  if (actions.includes(v.action!)) result.action = v.action;
  if (codes.includes(v.code!)) result.code = v.code;
  const url = diagnosticUrl(v.url); if (url) result.url = url;
  for (const key of ['optionCount', 'selectedCount', 'quantity'] as const) {
    const n = v[key]; if (Number.isSafeInteger(n) && n! >= 0 && n! <= 20000) result[key] = n;
  }
  for (const key of ['elapsedMs', 'httpStatus', 'resultCode'] as const) {
    const n = v[key]; if (Number.isSafeInteger(n) && n! >= 0 && n! <= (key === 'elapsedMs' ? 3600000 : key === 'httpStatus' ? 599 : 1000000000)) result[key] = n;
  }
  return result;
}

export function appendJournal(journal: CampJournal, entry: CampJournalEntry): CampJournal {
  const previous = journal.entries.at(-1);
  const equivalent = (v: CampJournalEntry) => JSON.stringify({ ...v, at: 0 });
  if (entry.kind === 'PAGE' && previous && equivalent(previous) === equivalent(entry) && entry.at - previous.at < 30000) return journal;
  return { ...journal, entries: [...journal.entries, entry].slice(-JOURNAL_LIMIT) };
}
