import type { CatalogSelection } from './catalog';
import type { VisibleOption } from './models';
import { normalize } from './preferences';

type Quote = CatalogSelection['tickets'][number];

/** Aliases come from the same catalog record, never substring/fuzzy matching. */
export function ticketHasLabel(ticket: Quote, label: string): boolean {
  const value = normalize(label);
  return !!value && [ticket.name, ticket.zoneName].some(name => name && normalize(name) === value);
}

export function ticketMatchesOption(ticket: Quote, option: Pick<VisibleOption, 'ticketTypeId' | 'label' | 'zoneLabel'>): boolean {
  return option.ticketTypeId ? ticket.id === option.ticketTypeId :
    ticketHasLabel(ticket, option.label) || (!!option.zoneLabel && ticketHasLabel(ticket, option.zoneLabel));
}
