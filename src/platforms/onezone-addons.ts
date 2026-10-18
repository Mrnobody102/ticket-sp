import type { EventPreferences } from '../core/models';
import type { AutoProgress } from '../core/automation';
import { normalize } from '../core/preferences';
import { ticketHasLabel } from '../core/ticket-identity';
import { currentPriceValues } from './onezone-options';
import type { PageReader } from './onezone-dom';

/** Optional merchandise step observed at the official /checkout/add-ons route. */
export function readOnezoneAddons(document: Document, url: URL, p: EventPreferences, progress: AutoProgress, reader: PageReader) {
  if (url.origin !== new URL(p.eventUrl).origin || url.pathname.replace(/\/$/, '') !== '/checkout/add-ons' ||
    !/^[\w-]{1,100}$/.test(url.searchParams.get('orderId') ?? '') || !p.catalog || !progress.chosen) return;
  const quote = p.catalog.tickets.find(t => t.id === progress.chosen!.ticketTypeId && ticketHasLabel(t, progress.chosen!.label));
  if (!quote || quote.priceVnd !== progress.chosen.displayedPriceVnd) return;
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(p.catalog.startsAt));
  const summaries = [...document.querySelectorAll('h1,h2,h3,p,span,div')].filter(e => reader.isVisible(e) &&
    normalize(reader.text(e)).includes('ve cua ban') && normalize(reader.text(e)).includes(normalize(p.catalog!.title)));
  const summaryValid = summaries.some(element => {
    for (let card: Element | null = element, depth = 0; card && card !== document.body && depth < 4; card = card.parentElement, depth++) {
      const text = normalize(reader.text(card));
      if (text.length > 1200) break;
      const quantity = text.match(/(?:×|x)\s*(\d{1,3})(?!\d)/);
      const prices = currentPriceValues(card, reader);
      if (text.includes(date) && text.includes(normalize(quote.name)) && quantity && Number(quantity[1]) === p.quantity &&
        prices.length === 1 && prices[0] === quote.priceVnd) return true;
    }
    return false;
  });
  if (!summaryValid) return;
  const next = [...document.querySelectorAll<HTMLButtonElement>('button')].filter(e => reader.isVisible(e) &&
    /^(tiep tuc|continue)$/.test(normalize(reader.name(e))) && !e.matches(':disabled,[aria-disabled="true"]') &&
    !e.closest('[inert],[aria-disabled="true"]') && !e.matches('a[href]'));
  if (next.length !== 1) return;
  let totalVerified = false;
  for (let footer = next[0]!.parentElement, depth = 0; footer && footer !== document.body && depth < 5; footer = footer.parentElement, depth++) {
    const prices = currentPriceValues(footer, reader);
    if (prices.length) { totalVerified = prices.length === 1 && prices[0] === quote.priceVnd * p.quantity; break; }
  }
  return totalVerified ? next[0] : undefined;
}
