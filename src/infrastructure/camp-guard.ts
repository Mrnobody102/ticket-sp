import { AUTO_TIMING, autoWatching, preferencesKey, type AutoRun } from '../core/automation';
import type { EventPreferences } from '../core/models';

export const CAMP_GUARD_ALARM = 'ticket-assistant.camp-guard';
export const CAMP_GUARD_KEY = 'ticket-assistant.camp-guard.v1';
interface GuardLease { runId: string; tabId: number; autoDiscardable: boolean; focused: boolean }

async function release(lease?: GuardLease) {
  chrome.power.releaseKeepAwake();
  await chrome.alarms.clear(CAMP_GUARD_ALARM);
  if (lease?.autoDiscardable) {
    // Restore the original policy, including after owner tab transfer or worker restart.
    await chrome.tabs.update(lease.tabId, { autoDiscardable: true }).catch(() => undefined);
  }
  await chrome.storage.session.remove(CAMP_GUARD_KEY);
}

/** Coarse lifecycle protection only. DOM/redraw, not this alarm, triggers purchases. */
export async function reconcileCampGuard(run: AutoRun | null, p: EventPreferences | null, now = Date.now(), currentRun?: () => Promise<AutoRun | null>): Promise<void> {
  let lease = (await chrome.storage.session.get(CAMP_GUARD_KEY))[CAMP_GUARD_KEY] as GuardLease | undefined;
  const watching = run && p && autoWatching(run) && run.expiresAt > now && run.preferencesKey === preferencesKey(p);
  if (!watching) { await release(lease); return; }
  // A replacement inherits Chrome's temporary autoDiscardable=false flag;
  // retain the user's original policy rather than treating it as a preference.
  const replacedPolicy = lease?.runId === run.id && lease.tabId !== run.tabId ? lease.autoDiscardable : undefined;
  if (lease && (lease.runId !== run.id || lease.tabId !== run.tabId)) {
    await release(lease); lease = undefined;
  }

  chrome.power.requestKeepAwake('system');
  const prepareAt = p.startMode === 'IMMEDIATE' ? now : Date.parse(p.saleStartAt) - AUTO_TIMING.watchLeadMs;
  if (!await chrome.alarms.get(CAMP_GUARD_ALARM)) {
    await chrome.alarms.create(CAMP_GUARD_ALARM, { when: Math.min(now + 30000, Math.max(now + 100, prepareAt)), periodInMinutes: 0.5 });
  }
  const tab = await chrome.tabs.get(run.tabId).catch(() => undefined);
  if (!tab) return; // onRemoved owns run cancellation; the next reconcile releases the lease.
  if (!lease) {
    lease = { runId: run.id, tabId: run.tabId, autoDiscardable: replacedPolicy ?? tab.autoDiscardable ?? true, focused: false };
    await chrome.storage.session.set({ [CAMP_GUARD_KEY]: lease });
  }
  if (tab.autoDiscardable !== false) await chrome.tabs.update(run.tabId, { autoDiscardable: false });
  // One foreground activation before the sale. A discarded owner tab must be
  // activated to let Chrome restore it; never navigate or refresh a queue/cart.
  if (tab.discarded || (!lease.focused && now >= prepareAt)) {
    await chrome.tabs.update(run.tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    lease = { ...lease, focused: true };
    await chrome.storage.session.set({ [CAMP_GUARD_KEY]: lease });
  }
  // Reattach a live content runner after lifecycle interruptions. No polling of
  // the ticket server, no duplicate START, no replay of website requests.
  const latest = currentRun ? await currentRun() : run;
  if (latest?.id === run.id && latest.tabId === run.tabId) {
    void chrome.tabs.sendMessage(latest.tabId, { type: 'AUTO_UPDATED', run: latest }).catch(() => undefined);
  }
}
