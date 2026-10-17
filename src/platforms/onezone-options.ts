import type { SeatSelectionMode, VisibleOption } from '../core/models';
import { normalize } from '../core/preferences';
import { createPageReader, type PageReader } from './onezone-dom';
import type { OptionElement } from './contracts';
import type { CatalogSelection } from '../core/catalog';
export type { OptionElement } from './contracts';

function pricePattern(): RegExp {
  const amount = '(?:\\d{1,3}(?:[.,\\s]\\d{3})+|\\d+)';
  const currency = '(?:₫|đ|VNĐ|VND)';
  return new RegExp(`(?<![\\p{L}\\p{N}.,])(?:${currency}\\s*(${amount})(?![\\p{L}\\p{N}.,])|(${amount})\\s*${currency}(?![\\p{L}\\p{N}]))`, 'giu');
}

export function priceValues(text: string): number[] {
  return [...new Set([...text.matchAll(pricePattern())]
    .map(m => Number((m[1] ?? m[2])?.replace(/[.,\s]/g, ''))).filter(Number.isSafeInteger))];
}

export function currentPriceValues(element: Element, reader: PageReader): number[] {
  const walker = element.ownerDocument.createTreeWalker(element, 4);
  const parts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (parent && reader.isVisible(parent) && !parent.closest('del,s,.line-through')) parts.push(node.textContent ?? '');
  }
  return priceValues(parts.join(' '));
}

/** Read semantic HTML controls. This is not a reader for unlabeled graphical maps. */
export function readOptionElements(document: Document, mode: SeatSelectionMode = 'UNKNOWN', reader: PageReader = createPageReader(document), quotes: CatalogSelection['tickets'] = []): OptionElement[] {
  const { isVisible, text } = reader;
  const candidates = [...document.querySelectorAll('button, [role="option"], [role="radio"], label, article, li, section, [role="group"]')];
  const optionsByElement = new Map<Element, Omit<VisibleOption, 'id'>>();
  for (const element of candidates) {
    if (!isVisible(element)) continue;
    const content = text(element);
    if (!content || content.length > 400) continue;
    const aria = element.getAttribute('aria-label');
    const prices = priceValues(content + ' ' + (aria ?? ''));
    if (prices.length !== 1) continue;
    const headings = [...element.querySelectorAll('h2, h3, h4, [role="heading"], legend')].filter(isVisible);
    const direct = element.matches('button, [role="option"], [role="radio"]');
    const controls = [...element.querySelectorAll('button, input[type="radio"], input[type="number"], [role="spinbutton"]')]
      .filter(isVisible).filter(control => !/xem tat ca|xem chi tiet|see all|view details|read more/.test(normalize(control.getAttribute('aria-label') ?? text(control))));
    if (!direct && (!controls.length || headings.length !== 1)) continue;
    const label = (headings[0] ? text(headings[0]) : (aria ?? content)).replace(pricePattern(), '')
      .replace(/\b(chọn|mua|select|sold out|available)\b/giu, '').replace(/hết vé|còn vé/giu, '')
      .replace(/[|·:–—]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!label || label.length > 100 || /thanh toan|tiep tuc|xac nhan|tong cong|dat ve|xem tat ca|xem chi tiet|view details/.test(normalize(label))) continue;
    const disabled = element.matches(':disabled, [aria-disabled="true"]') || element.closest('[aria-disabled="true"]') !== null ||
      (controls.length > 0 && controls.every(c => c.matches(':disabled, [aria-disabled="true"]')));
    const unavailable = disabled || /het ve|sold out|khong kha dung|tam het/.test(normalize(content));
    const seat = direct && (/^(ghe|seat)\s+\S+/.test(normalize(label)) ||
      ((mode === 'PICK_SEAT' || mode === 'MIXED') && /^[a-z]{1,4}[- ]?\d+[a-z]?$/i.test(label)));
    const group = seat ? element.parentElement?.closest('[role="group"][aria-label], [role="radiogroup"][aria-label]') : undefined;
    const zoneLabel = group && isVisible(group) ? group.getAttribute('aria-label')?.trim() : undefined;
    const selected = element.matches('[aria-selected="true"], [aria-checked="true"], [aria-pressed="true"], input:checked') ||
      controls.some(c => c.matches('[aria-selected="true"], [aria-checked="true"], [aria-pressed="true"], input:checked'));
    const option: Omit<VisibleOption, 'id'> = {
      label, kind: seat ? 'SEAT' : 'ZONE',
      zoneLabel: zoneLabel && zoneLabel.length <= 100 ? zoneLabel : undefined, selected,
      ticketTypeId: element.getAttribute('data-ticket-class-id') ?? element.getAttribute('data-ticket-type-id') ?? undefined,
      displayedPriceVnd: prices[0], displayedAvailability: unavailable ? 'UNAVAILABLE' : 'AVAILABLE',
    };
    // A priced child control is more specific than its card/group. In particular,
    // a group of equally priced seats must never become one purchasable zone.
    for (let parent = element.parentElement; parent; parent = parent.parentElement) optionsByElement.delete(parent);
    optionsByElement.set(element, option);
  }
  // Official cards can use <p> for their title. Bind them only with a matching
  // catalog quote, one explicit select/buy control and an unambiguous unit price.
  for (const button of document.querySelectorAll<HTMLElement>('button, [role="button"]')) {
    if (!isVisible(button) || !/^(chon|chon ve|mua ve|dat ve|select)$/.test(normalize(button.getAttribute('aria-label') ?? text(button)))) continue;
    let card = button.parentElement;
    for (let depth = 0; card && card !== document.body && depth < 5; card = card.parentElement, depth++) {
      const names = quotes.filter(q => [...card!.querySelectorAll('p,h2,h3,h4,span')].some(e => isVisible(e) && normalize(text(e)) === normalize(q.name)));
      if (names.length !== 1) continue;
      const quote = names[0]!;
      // Preserve selected/ID evidence already read from a semantic card.
      if (optionsByElement.has(card)) break;
      const actions = [...card.querySelectorAll('button, [role="button"]')].filter(e => isVisible(e) && /^(chon|chon ve|mua ve|dat ve|select)$/.test(normalize(e.getAttribute('aria-label') ?? text(e))));
      if (actions.length !== 1) break;
      const unique = currentPriceValues(card, reader);
      if (unique.length !== 1 || unique[0] !== quote.priceVnd) break;
      const selected = card.matches('[aria-selected="true"],[aria-checked="true"],[aria-pressed="true"]') || button.matches('[aria-selected="true"],[aria-checked="true"],[aria-pressed="true"]');
      optionsByElement.set(card, { kind: 'ZONE', label: quote.name, displayedPriceVnd: unique[0], selected,
        displayedAvailability: button.matches(':disabled,[aria-disabled="true"]') ? 'UNAVAILABLE' : 'AVAILABLE' });
      break;
    }
  }
  // Apply the display limit after resolving groups, keeping DOM order and unique IDs.
  return [...optionsByElement].slice(0, 100).map(([element, option], index) => ({
    element, option: { id: `option-${index}`, ...option },
  }));
}
