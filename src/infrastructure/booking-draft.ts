import { parseBookingDraft, type BookingDraft } from '../core/booking-draft';

export const DRAFT_KEY = 'ticket-assistant.booking-draft.v1';
export async function loadBookingDraft(baseKey: string) {
  return parseBookingDraft((await chrome.storage.local.get(DRAFT_KEY))[DRAFT_KEY], baseKey);
}
export function saveBookingDraft(baseKey: string, form: BookingDraft, dirty: boolean) {
  // Dispatch storage immediately from the edit handler, before popup teardown.
  return chrome.storage.local.set({ [DRAFT_KEY]: { schemaVersion: 1, baseKey, form, dirty } });
}
export function clearBookingDraft() { return chrome.storage.local.remove(DRAFT_KEY); }
