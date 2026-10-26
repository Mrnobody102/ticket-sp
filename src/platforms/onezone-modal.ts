import type { EventPreferences } from '../core/models';
import type { AutoQuantity } from '../core/automation';
import type { OptionElement } from './contracts';
import type { PageReader } from './onezone-dom';
import { normalize } from '../core/preferences';
import { currentPriceValues } from './onezone-options';
import { ticketHasLabel } from '../core/ticket-identity';

export function hasOnezoneVerification(document: Document, reader: PageReader): boolean {
  return [...document.querySelectorAll('iframe')].some(e => reader.isVisible(e) && /captcha|challenge/i.test(e.title + ' ' + e.src));
}

export interface OnezoneModal {
  entry: OptionElement;
  quantity: AutoQuantity;
  valueElement: HTMLElement;
  increase: HTMLElement;
  decrease: HTMLElement;
  advance: HTMLElement;
}

/** SelectTicketModal markers observed in the official client on 18/10/2026.
 * This reads visible controls only; it never accesses React internals or CAPTCHA tokens.
 */
export function readOnezoneModal(document: Document, p: EventPreferences, reader: PageReader): OnezoneModal | undefined {
  if (!p.catalog?.tickets.length) return;
  const advances = [...document.querySelectorAll<HTMLElement>('button[data-id="btn-continue"]')].filter(reader.isVisible);
  if (advances.length !== 1) return;
  const advance = advances[0]!;
  for (let root = advance.parentElement; root && root !== document.body; root = root.parentElement) {
    const plus = [...root.querySelectorAll<HTMLElement>('button[data-id="btn-add"]')].filter(reader.isVisible);
    const minus = [...root.querySelectorAll<HTMLElement>('button[data-id="btn-sub"]')].filter(reader.isVisible);
    if (plus.length !== 1 || minus.length !== 1 || plus[0]!.parentElement !== minus[0]!.parentElement) continue;
    if (![...root.querySelectorAll('h2,[role="heading"]')].some(e => reader.isVisible(e) && /chon ve|chon so luong/.test(normalize(reader.text(e))))) continue;
    const names = p.catalog.tickets.filter(q => [...root.querySelectorAll('p,h3,span')].some(e => reader.isVisible(e) && ticketHasLabel(q, reader.text(e))));
    if (names.length !== 1) return;
    const quote = names[0]!;
    // A quantity dialog does not prove which individual seats were selected.
    if (quote.seatMode === 'PICK') return;
    const namedZones = quote.zones?.filter(z => [...root.querySelectorAll('p,h3,span')].some(e => reader.isVisible(e) && normalize(reader.text(e)) === normalize(z.name))) ?? [];
    if (namedZones.length > 1) return;
    const identified = [root, ...root.querySelectorAll('[data-ticket-class-id],[data-ticket-type-id],[data-zone-id]')];
    const classIds = [...new Set(identified.flatMap(e => [e.getAttribute('data-ticket-class-id'), e.getAttribute('data-ticket-type-id')]).filter(Boolean))];
    if (classIds.length > 1 || (classIds.length === 1 && classIds[0] !== quote.id)) return;
    const zoneIds = [...new Set(identified.map(e => e.getAttribute('data-zone-id')).filter(Boolean))];
    const identifiedZone = zoneIds.length === 1 ? quote.zones?.find(z => z.id === zoneIds[0]) : undefined;
    if (zoneIds.length > 1 || (zoneIds.length === 1 && (!identifiedZone || (namedZones.length && namedZones[0]!.id !== identifiedZone.id)))) return;
    const physical = namedZones[0] ?? identifiedZone;
    const stepper = plus[0]!.parentElement!;
    const valueNodes = [...stepper.children].filter(e => e.tagName === 'SPAN' && /^\d{1,3}$/.test(reader.text(e)));
    if (valueNodes.length !== 1) return;
    const value = Number(reader.text(valueNodes[0]!));
    if (value < 1 || value > 100) return;
    const priceScope = stepper.parentElement!;
    const amounts = currentPriceValues(priceScope, reader);
    if (new Set(amounts).size !== 1 || amounts[0] !== quote.priceVnd) return;
    const disabled = (e: HTMLElement) => e.matches(':disabled,[aria-disabled="true"]');
    return {
      entry: { element: root, option: { id: `onezone-modal-${quote.id}`, kind: 'ZONE', label: quote.name, ticketTypeId: quote.id, zoneLabel: physical?.name, displayedPriceVnd: quote.priceVnd, displayedAvailability: 'AVAILABLE', selected: true } },
      quantity: { value, min: 1, max: disabled(plus[0]!) ? value : 100, writable: !disabled(plus[0]!) || !disabled(minus[0]!), stepper: true },
      valueElement: valueNodes[0]! as HTMLElement, increase: plus[0]!, decrease: minus[0]!, advance,
    };
  }
}
