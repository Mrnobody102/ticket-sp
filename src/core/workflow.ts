import type { EventPreferences, PageSnapshot, TaskConfig, VisibleOption } from './models';
import { isSameEvent, normalize } from './preferences';
import { ticketMatchesOption } from './ticket-identity';

export interface Recommendation { option: VisibleOption; rank: number; estimatedTotalVnd?: number }

export function recommend(snapshot: PageSnapshot, p: EventPreferences): Recommendation[] {
  if (!snapshot.supported || snapshot.state !== 'SELECTING' ||
      (snapshot.maxQuantity !== undefined && p.quantity > snapshot.maxQuantity)) return [];
  return snapshot.visibleOptions.flatMap(option => {
    if (option.displayedAvailability !== 'AVAILABLE' || option.selected) return [];
    // One seat is one ticket. Never present it as a group of N seats.
    if (option.kind === 'SEAT' && p.quantity !== 1) return [];
    const label = normalize(option.label);
    const zone = option.zoneLabel ? normalize(option.zoneLabel) : undefined;
    // Exact normalized labels prevent VIP from silently matching VVIP / VIP 2.
    const preferred = p.catalog?.tickets;
    const matches = preferred?.filter(t => ticketMatchesOption(t, option));
    if (matches && matches.length > 1) return [];
    const priority = preferred?.length ? preferred.findIndex(t => ticketMatchesOption(t, option))
      : p.preferredZoneLabels.findIndex(v => normalize(v) === label || (zone !== undefined && normalize(v) === zone));
    if (priority !== -1 && preferred?.[priority] && option.displayedPriceVnd !== preferred[priority]!.priceVnd) return [];
    if (priority === -1 && !p.allowAlternatives && p.preferredZoneLabels.length > 0) return [];
    const total = option.displayedPriceVnd === undefined ? undefined : option.displayedPriceVnd * p.quantity;
    if (p.maxTotalVnd !== undefined && (total === undefined || total > p.maxTotalVnd)) return [];
    return [{ option, rank: priority === -1 ? p.preferredZoneLabels.length : priority, estimatedTotalVnd: total }];
  }).sort((a, b) => a.rank - b.rank || (a.estimatedTotalVnd ?? Infinity) - (b.estimatedTotalVnd ?? Infinity) || Number(!!b.option.zoneLabel) - Number(!!a.option.zoneLabel));
}

export function effectiveSnapshot(snapshot: PageSnapshot, config: TaskConfig): PageSnapshot {
  if (!config.preferences) return { ...snapshot, state: 'NOT_READY', supported: false, reason: 'Mở tiện ích và nhập concert cần theo dõi.' };
  if (!config.enabled) return { ...snapshot, state: 'STOPPED', supported: false, reason: 'Đã dừng theo dõi. Bật lại trong tiện ích khi cần.' };
  if (!isSameEvent(snapshot.url, config.preferences.eventUrl)) {
    const blockedStep = ['WAITING_ROOM', 'CHALLENGE', 'CHECKOUT'].includes(snapshot.state);
    return {
      ...snapshot, state: blockedStep ? snapshot.state : 'UNKNOWN', supported: false,
      reason: blockedStep
        ? `${snapshot.reason} Chưa xác nhận trang này thuộc concert/suất diễn đã lưu.`
        : 'Chưa khớp link concert hoặc suất diễn đã lưu. Mở đúng trang để theo dõi.',
    };
  }
  return snapshot;
}

export function reminderKey(p: EventPreferences): string {
  return `${p.eventUrl}|${p.saleStartAt}`;
}

export function reminderIsDue(config: TaskConfig, notifiedKey: unknown, now: number): boolean {
  const p = config.preferences;
  if (!config.enabled || !p || notifiedKey === reminderKey(p)) return false;
  const elapsed = now - Date.parse(p.saleStartAt);
  return elapsed >= 0 && elapsed < 15 * 60 * 1000;
}
