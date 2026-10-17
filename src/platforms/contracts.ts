import type { AutoAction, AutoPage, AutoProgress } from '../core/automation';
import type { EventPreferences, PageSnapshot, Platform, VisibleOption } from '../core/models';

export interface OptionElement { option: VisibleOption; element: Element }
export interface PlatformInspection {
  snapshot: PageSnapshot;
  optionElements: OptionElement[];
  automation?: { page: AutoPage; execute(action: AutoAction): void };
}
export interface BrowserPlatformAdapter {
  readonly platform: Platform;
  readonly capabilities: { zone: boolean; singleSeat: boolean; adjacentSeats: boolean };
  matches(url: URL): boolean;
  inspect(document: Document, url: URL, context?: { preferences: EventPreferences; progress: AutoProgress }): PlatformInspection;
}
