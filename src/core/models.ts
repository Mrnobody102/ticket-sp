export type Platform = 'onezone' | 'ticketbox' | 'cticket';
export type SeatSelectionMode = 'ZONE_ONLY' | 'PICK_SEAT' | 'ASSIGNED_SEAT' | 'MIXED' | 'UNKNOWN';
export type WorkflowState = 'NOT_READY' | 'WAITING_ROOM' | 'EVENT_PAGE' | 'SELECTING' | 'CHECKOUT' | 'CHALLENGE' | 'UNKNOWN' | 'STOPPED';

export interface EventPreferences {
  platform: Platform;
  eventUrl: string;
  saleStartAt: string;
  quantity: number;
  maxTotalVnd?: number;
  preferredZoneLabels: string[];
  allowAlternatives: boolean;
}

export interface VisibleOption {
  id: string;
  label: string;
  kind: 'ZONE' | 'SEAT';
  zoneLabel?: string;
  selected?: boolean;
  displayedPriceVnd?: number;
  displayedAvailability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
}

export interface PageSnapshot {
  url: string;
  state: WorkflowState;
  selectionMode: SeatSelectionMode;
  visibleOptions: VisibleOption[];
  supported: boolean;
  reason: string;
  maxQuantity?: number;
}

export interface TaskConfig {
  schemaVersion: 1;
  preferences: EventPreferences | null;
  enabled: boolean;
  panelVisible: boolean;
}

export const DEFAULT_CONFIG: TaskConfig = {
  schemaVersion: 1, preferences: null, enabled: false, panelVisible: true,
};

export const DEFAULT_QUANTITY = 1;

export interface ConfigRepository {
  load(): Promise<TaskConfig>;
  save(config: TaskConfig): Promise<void>;
}
