import type { TaskConfig } from './models';
import { isSameEvent } from './preferences';
import { HANOI_PRESET } from './task-presets';

/** One-time correction on extension update; preserve all ticket choices. */
export function correctHanoiSaleDate(config: TaskConfig): TaskConfig {
  const p = config.preferences;
  if (!p || !isSameEvent(p.eventUrl, HANOI_PRESET.eventUrl) || Date.parse(p.saleStartAt) !== Date.parse('2026-10-19T05:00:00Z')) return config;
  return { ...config, preferences: { ...p, saleStartAt: HANOI_PRESET.saleStartAt } };
}
