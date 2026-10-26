export interface SeatRecord {
  id: string; ticketClassId: string; zoneId: string; zoneName: string; rowName: string; code: string;
}
export const seatLabel = (seat: SeatRecord) => `${seat.zoneName}-${seat.rowName}-${seat.code}`;
export const seatName = (seat: SeatRecord) => `${seat.rowName}-${seat.code}`;
const compare = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** Same physical zone, adjacent seats first, front rows and centre before edges.
 * Labels/IDs come from the website's own inventory, never image coordinates. */
export function seatPlans(seats: SeatRecord[], quantity: number): SeatRecord[][] {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return [];
  const rows = new Map<string, SeatRecord[]>();
  for (const seat of seats) {
    const key = `${seat.zoneId}/${seat.rowName}`;
    rows.set(key, [...(rows.get(key) ?? []), seat]);
  }
  const plans: { seats: SeatRecord[]; row: string; centre: number; contiguous: boolean }[] = [];
  for (const row of rows.values()) {
    row.sort((a, b) => compare(a.code, b.code));
    for (let i = 0; i + quantity <= row.length; i++) {
      const group = row.slice(i, i + quantity);
      const contiguous = group.every((s, n) => n === 0 || (/^\d+$/.test(s.code) && Number(s.code) === Number(group[n - 1]!.code) + 1));
      plans.push({ seats: group, row: group[0]!.rowName, centre: Math.abs(i + (quantity - 1) / 2 - (row.length - 1) / 2), contiguous });
    }
  }
  plans.sort((a, b) => Number(b.contiguous) - Number(a.contiguous) || compare(a.row, b.row) || a.centre - b.centre || compare(seatLabel(a.seats[0]!), seatLabel(b.seats[0]!)));
  return plans.map(p => p.seats);
}
