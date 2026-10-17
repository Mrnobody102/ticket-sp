import type { SeatSelectionMode } from '../core/models';
import { normalize } from '../core/preferences';

/** Descriptive evidence only; never assume a future event uses the same seat policy. */
export function readSelectionMode(text: string): SeatSelectionMode {
  const normalized = normalize(text);
  const assigned = /tu dong cap (so )?ghe|ghe (duoc )?tu (dong )?cap|cap (so )?ghe ngau nhien|ghe ngau nhien|random (seats?|ghe)|assigned seat/.test(normalized);
  const zoneOnly = /khong chon cho|khong chon ghe|zone only/.test(normalized);
  const positive = normalized.replace(/khong (?:can )?chon (?:cho|ghe)/g, '');
  const manual = /chon ghe|chon cho|chon vi tri (cho ngoi|ghe)|pick (a )?seat|seat selection/.test(positive);
  if (manual && (assigned || zoneOnly)) return 'MIXED';
  if (assigned) return 'ASSIGNED_SEAT';
  if (zoneOnly) return 'ZONE_ONLY';
  if (manual) return 'PICK_SEAT';
  return 'UNKNOWN';
}
