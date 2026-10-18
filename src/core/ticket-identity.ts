import type { CatalogSelection } from './catalog';
import type { VisibleOption } from './models';
import { normalize } from './preferences';

type Quote = CatalogSelection['tickets'][number];

/** Aliases come from the same catalog record, never substring/fuzzy matching. */
export function ticketHasLabel(ticket: Quote, label: string): boolean {
  const value = normalize(label);
  const zones = ticket.zones ? ticket.zones.map(zone => zone.name) : [ticket.zoneName];
  return !!value && [ticket.name, ...zones].some(name => name && normalize(name) === value);
}

export function ticketZoneForLabel(ticket: Quote, label: string) {
  return ticket.zones?.find(zone => normalize(zone.name) === normalize(label));
}

export function ticketMatchesOption(ticket: Quote, option: Pick<VisibleOption, 'ticketTypeId' | 'label' | 'zoneLabel'> & Partial<Pick<VisibleOption, 'kind'>>): boolean {
  if (option.ticketTypeId !== undefined && ticket.id !== option.ticketTypeId) return false;
  // A1 is a seat label, not a contradictory class name. An explicit class ID
  // can bind it, while any visible parent zone must still match the catalog.
  if (option.kind === 'SEAT' && option.ticketTypeId === ticket.id) return !option.zoneLabel || ticketHasLabel(ticket, option.zoneLabel);
  const named = ticketHasLabel(ticket, option.label) || (!!option.zoneLabel && ticketHasLabel(ticket, option.zoneLabel));
  return named;
}
