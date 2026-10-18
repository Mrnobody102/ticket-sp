import type { EventPreferences } from '../core/models';
import type { OptionElement } from './contracts';
import { normalize } from '../core/preferences';
import { MAP_REPLY, MAP_REQUEST, type MapZone } from './onezone-map-bridge';
import type { PageReader } from './onezone-dom';
import { currentPriceValues } from './onezone-options';

function requestMap(document: Document, p: EventPreferences, choose?: MapZone): { zones: MapZone[]; selected?: boolean } {
  if (!p.catalog) return { zones: [] };
  const view = document.defaultView!;
  const requestId = view.crypto.randomUUID();
  let result: { zones: MapZone[]; selected?: boolean } = { zones: [] };
  const listener = (event: Event) => {
    try {
      const reply = JSON.parse((event as CustomEvent<string>).detail);
      if (reply.requestId === requestId && Array.isArray(reply.zones) && reply.zones.length <= 500) result = reply;
    } catch { /* Ignore unrelated page messages. */ }
  };
  document.addEventListener(MAP_REPLY, listener);
  try { document.dispatchEvent(new view.CustomEvent(MAP_REQUEST, { detail: JSON.stringify({ requestId, eventId: p.catalog.eventId, calendarId: p.catalog.performanceId, choose }) })); }
  finally { document.removeEventListener(MAP_REPLY, listener); }
  return result;
}
const bindings = new WeakMap<Element, Map<string, MapZone>>();
export function readOnezoneMap(document: Document, p: EventPreferences, reader: PageReader): OptionElement[] {
  const zones = requestMap(document, p).zones;
  const entries: OptionElement[] = [];
  const containers = new Map<Element, Map<string, MapZone>>();
  for (const zone of zones) {
    if (!zone || typeof zone.containerId !== 'string' || typeof zone.label !== 'string' || typeof zone.disabled !== 'boolean') continue;
    const quote = p.catalog?.tickets.find(t => t.id === zone.ticketClassId);
    const physical = quote?.zones?.find(z => z.id === zone.zoneId && normalize(z.name) === normalize(zone.label));
    const container = document.getElementById(zone.containerId);
    if (!quote || !physical || !container || quote.seatMode === 'PICK') continue;
    // The map identifies physical zones; the price legend may show only their
    // shared ticket class (e.g. HAI QUÝ - EB for HAI QUÝ 1 and 2).
    const labels = new Set([normalize(physical.name), normalize(quote.name)]);
    const names = [...document.querySelectorAll('p,h2,h3,h4,span')].filter(e => reader.isVisible(e) && labels.has(normalize(reader.text(e))));
    const observedPrices = [...new Set(names.flatMap(name => {
      let card: Element | null = name.parentElement;
      for (let depth = 0; card && card !== document.body && depth < 4; depth++, card = card.parentElement) {
        const prices = currentPriceValues(card, reader);
        if (prices.length) return prices;
      }
      return [];
    }))];
    if (observedPrices.length !== 1 && !zone.disabled) continue;
    const optionId = `onezone-map-${zone.zoneId}`;
    let bound = containers.get(container);
    if (!bound) { bound = new Map(); containers.set(container, bound); }
    if (bound.has(optionId)) return []; // Ambiguous duplicated objects are never collapsed.
    bound.set(optionId, zone);
    entries.push({ element: container, option: { id: optionId, label: quote.name, zoneLabel: physical.name, ticketTypeId: quote.id,
      kind: 'ZONE', displayedPriceVnd: observedPrices.length === 1 ? observedPrices[0] : undefined, displayedAvailability: zone.disabled ? 'UNAVAILABLE' : 'AVAILABLE', selected: false } });
  }
  for (const [container, bound] of containers) bindings.set(container, bound);
  return entries;
}
export function hasMapChoice(element: Element, optionId: string) { return bindings.get(element)?.has(optionId) === true; }
export function chooseOnezoneMap(element: Element, optionId: string, p: EventPreferences) {
  const zone = bindings.get(element)?.get(optionId);
  if (!zone || !element.isConnected || !requestMap(element.ownerDocument, p, zone).selected) throw new Error('Không chọn được khu đã xác minh trên sơ đồ. Kiểm tra trang.');
}
