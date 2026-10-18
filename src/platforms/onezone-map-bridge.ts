// Public Konva Node/Stage APIs and custom attributes observed in 1Zone's zone renderer.
// This bridge has no Chrome API, account data, network transport or CAPTCHA access.
export const MAP_REQUEST = 'camp-ve:onezone-zone-request';
export const MAP_REPLY = 'camp-ve:onezone-zone-reply';
export const MAP_CHANGED = 'camp-ve:onezone-zone-changed';
export interface MapZone { containerId: string; zoneId: string; ticketClassId: string; label: string; disabled: boolean }
interface MapNode {
  getAttr(name: string): unknown;
  isVisible(): boolean;
  isListening(): boolean;
  fire(name: string, event: object, bubble: boolean): unknown;
}
interface MapLayer { on(name: string, listener: () => void): void; off(name: string): void }
interface MapStage { container(): HTMLElement; find(selector: string): MapNode[]; getLayers(): MapLayer[] }
type MapWindow = Window & typeof globalThis & { Konva?: { stages: MapStage[] }; __campZoneBridgeCleanup?: () => void };
const id = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);

export function installOnezoneMapBridge(view: Window & typeof globalThis) {
  const state = view as MapWindow;
  state.__campZoneBridgeCleanup?.();
  const watchedLayers = new Set<MapLayer>();
  const listener = (event: Event) => {
    let request: { requestId?: string; eventId?: string; calendarId?: string; choose?: MapZone };
    try { request = JSON.parse((event as CustomEvent<string>).detail); } catch { return; }
    if (!request || !id(request.requestId) || !id(request.eventId) || !id(request.calendarId) ||
      view.location.hostname !== 'ticket.1zone.vn' || !view.location.pathname.startsWith('/booking/') ||
      new URL(view.location.href).searchParams.get('calendarId') !== request.calendarId) return;
    try {
      const matches: { zone: MapZone; node: MapNode }[] = [];
      for (const stage of (view as MapWindow).Konva?.stages ?? []) {
        const container = stage.container();
        if (!container?.isConnected || !container.id.startsWith(`seatmap-container-${request.eventId}-`) || !container.getClientRects().length || container.closest('.pointer-events-none,[inert],[hidden]')) continue;
        let visible = true;
        for (let parent: HTMLElement | null = container; parent; parent = parent.parentElement) {
          const style = view.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') { visible = false; break; }
        }
        if (!visible) continue;
        for (const layer of stage.getLayers()) if (!watchedLayers.has(layer)) {
          watchedLayers.add(layer);
          layer.on('draw.campZone', () => view.document.dispatchEvent(new view.CustomEvent(MAP_CHANGED)));
        }
        const nodes = stage.find('.seat');
        if (nodes.length > 500) continue;
        for (const node of nodes) {
          const zoneId = node.getAttr('zoneId'), ticketClassId = node.getAttr('ticketClassId'), label = node.getAttr('text'), disabled = node.getAttr('disabled');
          if (!id(zoneId) || !id(ticketClassId) || typeof label !== 'string' || !label.trim() || label.length > 100 || typeof disabled !== 'boolean' || !node.isVisible() || !node.isListening()) continue;
          matches.push({ zone: { containerId: container.id, zoneId, ticketClassId, label, disabled }, node });
        }
      }
      let selected = false;
      if (request.choose) {
        const choice = request.choose;
        const exact = matches.filter(({ zone }) => zone.containerId === choice.containerId && zone.zoneId === choice.zoneId && zone.ticketClassId === choice.ticketClassId && zone.label === choice.label);
        if (exact.length !== 1 || exact[0]!.zone.disabled || choice.disabled) throw new Error('Khu đã thay đổi hoặc không còn khả dụng.');
        exact[0]!.node.fire('click', { evt: new view.MouseEvent('click', { bubbles: true }) }, true);
        selected = true;
      }
      view.document.dispatchEvent(new view.CustomEvent(MAP_REPLY, { detail: JSON.stringify({ requestId: request.requestId, zones: matches.map(m => m.zone), selected }) }));
    } catch {
      view.document.dispatchEvent(new view.CustomEvent(MAP_REPLY, { detail: JSON.stringify({ requestId: request.requestId, zones: [], selected: false }) }));
    }
  };
  view.document.addEventListener(MAP_REQUEST, listener);
  const cleanup = () => { view.document.removeEventListener(MAP_REQUEST, listener); for (const layer of watchedLayers) layer.off('draw.campZone'); };
  state.__campZoneBridgeCleanup = cleanup;
  return cleanup;
}
