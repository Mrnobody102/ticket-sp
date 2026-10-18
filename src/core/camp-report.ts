import { preferencesKey, type AutoRun } from './automation';
import type { EventPreferences, PageSnapshot } from './models';

// Export only explicit diagnostic fields. Never serialize the config, DOM or URL tokens.
function publicUrl(value: string) {
  try {
    const url = new URL(value);
    const calendar = url.searchParams.get('calendarId');
    return url.origin + url.pathname + (calendar ? `?calendarId=${encodeURIComponent(calendar)}` : '');
  } catch { return undefined; }
}
export function createCampReport(version: string, p: EventPreferences | null, snapshot: PageSnapshot, run: AutoRun | null, observedQuantity?: number, error?: string, now = Date.now()) {
  const progress = run?.progress;
  const chosen = progress?.chosen;
  const elapsed = (from?: number, to?: number) => from !== undefined && to !== undefined && to >= from ? to - from : undefined;
  return {
    schemaVersion: 1, version, capturedAt: new Date(now).toISOString(),
    scope: 'DOM observation; not a server reservation confirmation or a complete click history',
    requested: p ? { platform: p.platform, eventUrl: publicUrl(p.eventUrl), startMode: p.startMode ?? 'SCHEDULED', saleStartAt: p.startMode === 'IMMEDIATE' ? undefined : p.saleStartAt, quantity: p.quantity,
      priorities: p.preferredZoneLabels, maxTotalVnd: p.maxTotalVnd } : null,
    page: { url: publicUrl(snapshot.url), state: snapshot.state, supported: snapshot.supported, reason: snapshot.reason,
      selectionMode: snapshot.selectionMode, maxQuantity: snapshot.maxQuantity, observedQuantity,
      selected: snapshot.visibleOptions.filter(o => o.selected).map(o => ({ label: o.label, kind: o.kind, zoneLabel: o.zoneLabel,
        ticketTypeId: o.ticketTypeId, displayedPriceVnd: o.displayedPriceVnd })) },
    run: run && progress ? { id: run.id, revision: run.revision, preferencesMatch: !!p && run.preferencesKey === preferencesKey(p), startedAt: run.startedAt, expiresAt: run.expiresAt,
      phase: progress.phase, message: progress.message, lastActionAt: progress.actionAt, selectionStartedAt: progress.selectionStartedAt,
      checkoutReachedAt: progress.checkoutReachedAt, releaseReloadedAt: progress.releaseReloadedAt, lastReleaseReloadAt: progress.lastReleaseReloadAt,
      chosen: chosen ? { label: chosen.label, kind: chosen.kind, zoneLabel: chosen.zoneLabel, ticketTypeId: chosen.ticketTypeId, displayedPriceVnd: chosen.displayedPriceVnd } : undefined,
      selectionToCheckoutMs: elapsed(progress.selectionStartedAt, progress.checkoutReachedAt) } : null,
    error,
  };
}
