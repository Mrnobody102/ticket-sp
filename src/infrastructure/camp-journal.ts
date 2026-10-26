import { appendJournal, journalEntry, type CampJournal, type CampJournalEntry } from '../core/camp-journal';
import type { AutoRun } from '../core/automation';
import { sendToBackground } from './extension-runtime';

export const JOURNAL_KEY = 'ticket-assistant.journal.v1';
let pending: Promise<unknown> = Promise.resolve();

/** Local diagnostics have their own queue and never delay a website action. */
export function recordCampJournal(run: AutoRun, value: CampJournalEntry): void {
  const entry = journalEntry(value);
  if (!entry) return;
  const storage = chrome.storage.local;
  pending = pending.catch(() => undefined).then(async () => {
    const raw: unknown = (await storage.get(JOURNAL_KEY))[JOURNAL_KEY];
    const logs = Array.isArray(raw) ? raw.filter((j): j is CampJournal => !!j && typeof j.runId === 'string' && Number.isFinite(j.startedAt) && Array.isArray(j.entries)).slice(-3) : [];
    const existing = logs.find(j => j.runId === run.id) ?? { runId: run.id, startedAt: run.startedAt, entries: [] };
    const next = appendJournal(existing, entry);
    if (existing === next) return;
    await storage.set({ [JOURNAL_KEY]: [...logs.filter(j => j.runId !== run.id), next].slice(-3) });
  }).catch(() => undefined);
}

export async function readCampJournal(runId?: string): Promise<CampJournal | null> {
  await pending;
  const raw: unknown = (await chrome.storage.local.get(JOURNAL_KEY))[JOURNAL_KEY];
  if (!Array.isArray(raw)) return null;
  return raw.findLast((j: CampJournal) => typeof j?.runId === 'string' && Array.isArray(j.entries) && (!runId || j.runId === runId)) ?? null;
}

export function observeCamp(run: AutoRun, entry: CampJournalEntry): void {
  void sendToBackground({ type: 'CAMP_OBSERVE', runId: run.id, entry }).catch(() => undefined);
}
export async function getCampJournal(): Promise<CampJournal | null> {
  const reply = await sendToBackground<{ journal?: CampJournal | null }>({ type: 'CAMP_JOURNAL' });
  return reply?.journal ?? null;
}
