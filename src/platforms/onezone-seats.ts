import type { EventPreferences } from '../core/models';
import { normalize } from '../core/preferences';
import type { OptionElement } from './contracts';
import type { PageReader } from './onezone-dom';
import { currentPriceValues, priceValues } from './onezone-options';
import { SEATS_REPLY, SEATS_REQUEST, type SeatGroup, type SeatsState } from './onezone-seats-bridge';

const bindings = new WeakMap<Element, Map<string, SeatGroup>>();
const states = new WeakMap<Document, SeatsState>();
const priceWait = new WeakMap<Document, { key: string; since: number }>();
const empty = (): SeatsState => ({ ready: false, groups: [] });
function request(document: Document, p: EventPreferences, choose?: SeatGroup): SeatsState {
  if (!p.catalog) return empty();
  const quotes = p.catalog.tickets.filter(t => (t.maxQuantity === undefined || t.maxQuantity >= p.quantity) && (p.maxTotalVnd === undefined || t.priceVnd * p.quantity <= p.maxTotalVnd));
  if (!quotes.length) return { ready: true, groups: [], problem: 'Kiểm tra số vé và ngân sách.' };
  const view = document.defaultView!, requestId = view.crypto.randomUUID();
  let result = empty();
  const reply = (event: Event) => {
    try {
      const value = JSON.parse((event as CustomEvent<string>).detail);
      if (value.requestId === requestId && typeof value.ready === 'boolean' && Array.isArray(value.groups) && value.groups.length <= 20) result = value;
    } catch { /* Ignore unrelated page events. */ }
  };
  document.addEventListener(SEATS_REPLY, reply);
  try { document.dispatchEvent(new view.CustomEvent(SEATS_REQUEST, { detail: JSON.stringify({ requestId, eventId: p.catalog.eventId, calendarId: p.catalog.performanceId, quantity: p.quantity,
    quotes: quotes.map(t => ({ id: t.id, name: t.name, zones: t.zones })), choose }) })); }
  finally { document.removeEventListener(SEATS_REPLY, reply); }
  states.set(document, result); return result;
}

export function readOnezoneSeats(document: Document, p: EventPreferences, reader: PageReader): { entries: OptionElement[]; state: SeatsState } | undefined {
  const container = document.getElementById('seatio');
  if (!container || !reader.isVisible(container) || !new URL(document.URL).pathname.startsWith('/booking/')) return;
  const state = request(document, p);
  const entries: OptionElement[] = [];
  const bound = new Map<string, SeatGroup>();
  let priceConflict = false;
  for (const group of state.groups) {
    if (!group || typeof group.ticketClassId !== 'string' || typeof group.zoneId !== 'string' || typeof group.zoneName !== 'string' || typeof group.selected !== 'boolean') continue;
    const quote = p.catalog?.tickets.find(q => q.id === group.ticketClassId);
    if (!quote || !quote.zones?.some(z => z.id === group.zoneId && normalize(z.name) === normalize(group.zoneName)) || !Array.isArray(group.labels) || !group.labels.length || group.labels.length > 10 ||
      group.labels.some(s => typeof s !== 'string' || !s || s.length > 100) || new Set(group.labels).size !== group.labels.length || !Array.isArray(group.names) || group.names.length !== group.labels.length || group.names.some(s => typeof s !== 'string' || !s || s.length > 100)) continue;
    // Independent price legend, excluding cart totals and quantity dialogs.
    const prices: number[] = [];
    for (const name of document.querySelectorAll('p,h2,h3,h4,span')) {
      if (!reader.isVisible(name) || name.closest('#seatio,.ticket-list-fixed-bar,[role="dialog"]') || ![quote.name, group.zoneName].some(n => normalize(reader.text(name)) === normalize(n))) continue;
      for (let card = name.parentElement, depth = 0; card && card !== document.body && depth < 4; card = card.parentElement, depth++) {
        const values = currentPriceValues(card, reader);
        if (values.length) { prices.push(...values); break; }
      }
    }
    if (new Set(prices).size !== 1 || prices[0] !== quote.priceVnd) { priceConflict ||= prices.length > 0; continue; }
    const id = `onezone-seats-${quote.id}-${group.zoneId}`;
    if (bound.has(id)) return { entries: [], state: { ...state, problem: 'Sơ đồ có lựa chọn trùng. Đang kiểm tra.' } };
    bound.set(id, group);
    entries.push({ element: container, option: { id, kind: 'ZONE', label: quote.name, zoneLabel: group.zoneName, ticketTypeId: quote.id,
      seatLabels: group.labels, selected: group.selected, displayedPriceVnd: quote.priceVnd, displayedAvailability: group.unavailable ? 'UNAVAILABLE' : 'AVAILABLE' } });
  }
  bindings.set(container, bound);
  let result = state;
  if (state.groups.length && !entries.length && !state.problem) {
    const key = `${p.eventUrl}|${JSON.stringify(p.catalog?.tickets.map(t => [t.id, t.priceVnd]))}`;
    let waiting = priceWait.get(document);
    if (!waiting || waiting.key !== key) { waiting = { key, since: Date.now() }; priceWait.set(document, waiting); }
    result = { ...state, ...(priceConflict ? { problem: 'Giá vé trên trang khác giá đã lưu. Kiểm tra lại hạng và giá.' }
      : Date.now() - waiting.since >= 15000 ? { problem: 'Chưa đọc được giá vé sau 15 giây. Chưa gửi chọn ghế.' }
        : { note: 'Đang chờ giá vé hiển thị khớp hạng đã lưu.' }) };
  } else priceWait.delete(document);
  states.set(document, result);
  return { entries, state: result };
}
export const hasSeatsChoice = (element: Element, optionId: string) => bindings.get(element)?.has(optionId) === true;
export function chooseOnezoneSeats(element: Element, optionId: string, p: EventPreferences) {
  const group = bindings.get(element)?.get(optionId);
  if (!group || !element.isConnected) throw new Error('Sơ đồ vừa đổi. Đang kiểm tra ghế.');
  const state = request(element.ownerDocument, p, group);
  if (!state.pending) throw new Error('Chưa xác nhận lệnh chọn ghế.');
}
export const readSeatsState = (document: Document) => states.get(document);

/** Match the website's selected chips and total before opening its verification
 * and order flow. This booking-page CTA is distinct from final payment. */
export function readSeatsContinue(document: Document, entries: OptionElement[], p: EventPreferences, reader: PageReader): HTMLElement | undefined {
  const selected = entries.filter(e => e.option.selected && e.option.seatLabels?.length);
  if (selected.length !== 1) return;
  const entry = selected[0]!, group = bindings.get(entry.element)?.get(entry.option.id);
  if (!group || group.labels.length !== p.quantity) return;
  const bars = [...document.querySelectorAll<HTMLElement>('.ticket-list-fixed-bar')].filter(reader.isVisible);
  if (bars.length !== 1) return;
  const bar = bars[0]!, removeButtons = [...bar.querySelectorAll<HTMLButtonElement>('button[aria-label="Remove ticket"]')].filter(reader.isVisible);
  if (removeButtons.length !== p.quantity) return;
  const names = new Set(group.names.map(normalize));
  for (const button of removeButtons) {
    const card = button.parentElement!;
    const matches = [...card.querySelectorAll('p,span')].filter(reader.isVisible).map(e => normalize(reader.text(e))).filter(s => names.has(s));
    const unique = [...new Set(matches)];
    // A label ending in "3" next to "990.000 ₫" must not parse as 3.990.000.
    const priced = [...card.querySelectorAll('p,span')].filter(reader.isVisible).filter(e => priceValues(reader.text(e)).length > 0);
    const values = [...new Set(priced.filter(e => !priced.some(child => child !== e && e.contains(child))).flatMap(e => priceValues(reader.text(e))))];
    if (unique.length !== 1 || !names.delete(unique[0]!) || values.length !== 1 || values[0] !== entry.option.displayedPriceVnd) return;
  }
  if (names.size) return;
  const controls = [...bar.children].filter(e => e.matches('button')).filter(reader.isVisible) as HTMLElement[];
  if (controls.length !== 1) return;
  const prices = currentPriceValues(controls[0]!, reader);
  return prices.length === 1 && prices[0] === entry.option.displayedPriceVnd! * p.quantity ? controls[0] : undefined;
}
