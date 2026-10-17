import type { EventPreferences } from '../core/models';
import type { AutoQuantity } from '../core/automation';
import type { OptionElement } from './contracts';
import type { PageReader } from './onezone-dom';
import { normalize } from '../core/preferences';
import { currentPriceValues } from './onezone-options';

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
    if (![...root.querySelectorAll('h2')].some(e => reader.isVisible(e) && /chon ve|chon so luong/.test(normalize(reader.text(e))))) continue;
    const names = p.catalog.tickets.filter(q => [...root.querySelectorAll('p,h3,span')].some(e => reader.isVisible(e) && normalize(reader.text(e)) === normalize(q.name)));
    if (names.length !== 1) return;
    const quote = names[0]!;
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
      entry: { element: root, option: { id: `onezone-modal-${quote.id}`, kind: 'ZONE', label: quote.name, displayedPriceVnd: quote.priceVnd, displayedAvailability: 'AVAILABLE', selected: true } },
      quantity: { value, min: 1, max: disabled(plus[0]!) ? value : 100, writable: !disabled(plus[0]!) || !disabled(minus[0]!), stepper: true },
      valueElement: valueNodes[0]! as HTMLElement, increase: plus[0]!, decrease: minus[0]!, advance,
    };
  }
}
