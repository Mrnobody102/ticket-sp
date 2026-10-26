import { normalize } from '../core/preferences';
import { MAP_CHANGED } from './onezone-map-bridge';
import { seatLabel, seatPlans, type SeatRecord } from './onezone-seat-plans';

export const SEATS_REQUEST = 'camp-ve:seats-request';
export const SEATS_REPLY = 'camp-ve:seats-reply';
export const SEATS_CANCEL = 'camp-ve:seats-cancel';
interface SeatQuote { id: string; name: string; zones?: { id: string; name: string }[] }
export interface SeatGroup { ticketClassId: string; zoneId: string; zoneName: string; labels: string[]; names: string[]; selected: boolean; unavailable?: boolean }
export interface SeatsState { ready: boolean; pending?: boolean; groups: SeatGroup[]; problem?: string; note?: string; retrySafe?: boolean }
interface SeatObject { id?: string; label: string; labels?: { section?: string; parent?: string; own?: string }; category?: { key: string | number; label: string }; selectable?: boolean; forSale?: boolean; selected?: boolean; objectType?: string; status?: string }
interface Chart {
  state: string; config: { event?: string; mode?: string; container?: HTMLElement; session?: string; onObjectSelected?: unknown };
  selectedObjects: string[];
  container(): HTMLElement;
  findObject(label: string): Promise<SeatObject>;
  listSelectedObjects(): Promise<SeatObject[]>;
  doSelectObjects(labels: string[]): Promise<void>;
  getReportBySelectability?(): Promise<{ selectable?: { byCategoryLabel?: Record<string, number> } }>;
}
type SeatsWindow = Window & typeof globalThis & { seatsio?: { charts: Chart[] }; __campSeatsCleanup?: () => void };
const validId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,100}$/.test(v);
const short = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 100;
const objectLabel = (o: SeatObject) => `${o.labels?.section}-${o.labels?.parent}-${o.labels?.own}`;

/** Only observes the website's existing inventory GETs. Never reads headers,
 * account/session storage, CAPTCHA tokens or calls a private purchase endpoint. */
export function installOnezoneSeatsBridge(window: Window & typeof globalThis) {
  const view = window as SeatsWindow;
  view.__campSeatsCleanup?.();
  let disposed = false;
  let controlEpoch = 0;
  const inventory = new Map<string, SeatRecord[]>();
  let current: { key: string; chart: Chart; state: SeatsState; at: number; loading: boolean; revision: number; readFailures: number } | undefined;
  const changed = () => { if (!disposed) view.document.dispatchEvent(new view.CustomEvent(MAP_CHANGED)); };
  // An iframe can disappear during queue admission or a chart rerender. Its
  // pending SDK promises have no built-in deadline; never leave the bridge stuck.
  function bounded<T>(promise: Promise<T>, ms = 2000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = view.setTimeout(() => reject(new Error('sdk-timeout')), ms);
      promise.then(value => { view.clearTimeout(timer); resolve(value); }, error => { view.clearTimeout(timer); reject(error); });
    });
  }
  function endpoint(input: string) {
    try {
      const url = new URL(input, view.location.href);
      const match = url.pathname.match(/^\/ticketing\/api\/v4\/event\/([\w-]+)\/tickets$/);
      const calendar = url.searchParams.get('calendarId');
      return url.origin === 'https://prod.1zone.vn' && match && validId(calendar) ? { event: match[1]!, calendar, key: `${match[1]}/${calendar}` } : undefined;
    } catch { return; }
  }
  function capture(url: string, payload: unknown) {
    const target = endpoint(url);
    if (!target || !payload || typeof payload !== 'object' || disposed) return;
    const data = payload as { errorCode?: number; data?: unknown };
    inventory.delete(target.key);
    if (data.errorCode !== 0 || !Array.isArray(data.data) || data.data.length > 20000) return;
    const seats: SeatRecord[] = [];
    for (const item of data.data as Record<string, unknown>[]) {
      if (!item || typeof item !== 'object' || (item.eventId && item.eventId !== target.event) || (item.calendarId && item.calendarId !== target.calendar)) return;
      const id = item._id ?? item.id;
      const code = typeof item.code === 'number' && Number.isInteger(item.code) && item.code >= 0 ? String(item.code) : item.code;
      if (!validId(id) || !validId(item.ticketClassId) || !validId(item.zoneId) || !short(item.zoneName) || !short(item.rowName) || !short(code)) continue;
      seats.push({ id, ticketClassId: item.ticketClassId, zoneId: item.zoneId, zoneName: item.zoneName, rowName: item.rowName, code });
    }
    if (new Set(seats.map(s => normalize(seatLabel(s)))).size !== seats.length || new Set(seats.map(s => s.id)).size !== seats.length) return;
    inventory.set(target.key, seats); if (current?.key.startsWith(`${target.key}|`)) current.at = 0;
    changed();
  }
  const originalFetch = view.fetch;
  const wrappedFetch: typeof fetch = function (...args) {
    const promise = originalFetch.apply(view, args);
    const input = args[0], url = typeof input === 'string' ? input : input instanceof view.URL ? input.href : input.url;
    if ((args[1]?.method ?? (input instanceof view.Request ? input.method : 'GET')).toUpperCase() === 'GET' && endpoint(url)) {
      void promise.then(response => { if (response.ok) void response.clone().json().then(value => capture(url, value)).catch(() => {}); }).catch(() => {});
    }
    return promise;
  };
  view.fetch = wrappedFetch;
  const xhrOpen = view.XMLHttpRequest.prototype.open;
  const xhrSend = view.XMLHttpRequest.prototype.send;
  const xhrUrls = new WeakMap<XMLHttpRequest, string>();
  const wrappedOpen = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    xhrUrls.delete(this);
    if (method.toUpperCase() === 'GET' && endpoint(String(url))) xhrUrls.set(this, String(url));
    return Reflect.apply(xhrOpen, this, [method, url, ...rest]);
  } as typeof xhrOpen;
  const wrappedSend = function (this: XMLHttpRequest, ...args: Parameters<XMLHttpRequest['send']>) {
    const url = xhrUrls.get(this);
    if (url) this.addEventListener('load', () => {
      if (this.status !== 200) return;
      try { capture(url, this.responseType === 'json' ? this.response : !this.responseType || this.responseType === 'text' ? JSON.parse(this.responseText) : null); } catch { /* Website response is untouched. */ }
    }, { once: true });
    return xhrSend.apply(this, args);
  };
  view.XMLHttpRequest.prototype.open = wrappedOpen;
  view.XMLHttpRequest.prototype.send = wrappedSend;

  function findChart(event: string) {
    const charts = (view.seatsio?.charts ?? []).filter(chart => {
      if (chart.config?.event !== event || chart.config.mode !== 'normal' || (chart.config.session && chart.config.session !== 'none') || chart.state === 'DESTROYED' || typeof chart.config.onObjectSelected !== 'function') return false;
      const container = chart.container();
      if (!container?.isConnected || !container.closest('#seatio') || !container.getClientRects().length) return false;
      for (let node: HTMLElement | null = container; node; node = node.parentElement) {
        const style = view.getComputedStyle(node);
        if (node.hidden || node.inert || style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none' || style.opacity === '0') return false;
      }
      return true;
    });
    return charts.length === 1 ? charts[0] : undefined;
  }
  function group(records: SeatRecord[], objects: SeatObject[], quotes: SeatQuote[], selected: boolean): SeatGroup | undefined {
    if (!records.length || records.length !== objects.length || new Set(records.map(s => s.zoneId)).size !== 1 || new Set(records.map(s => s.ticketClassId)).size !== 1) return;
    const first = records[0]!, quote = quotes.find(q => q.id === first.ticketClassId);
    if (records.some(s => normalize(s.zoneName) !== normalize(first.zoneName))) return;
    if (!quote || !quote.zones?.some(z => z.id === first.zoneId && normalize(z.name) === normalize(first.zoneName))) return;
    if (objects.some((o, i) => !short(o.label) || normalize(objectLabel(o)) !== normalize(seatLabel(records[i]!)) ||
      !o.category || ![quote.name, first.zoneName].some(n => normalize(n) === normalize(o.category!.label)) || o.objectType?.toLowerCase() !== 'seat')) return;
    return { ticketClassId: quote.id, zoneId: first.zoneId, zoneName: first.zoneName, labels: objects.map(o => o.label), names: records.map(s => `${s.rowName}-${s.code}`), selected };
  }
  async function refresh(entry: NonNullable<typeof current>, records: SeatRecord[], quotes: SeatQuote[], quantity: number) {
    if (entry.loading || entry.state.pending || entry.chart.state !== 'RENDERED') return;
    entry.loading = true;
    const revision = entry.revision;
    let next: SeatsState = entry.state;
    try {
      const selected = await bounded(entry.chart.listSelectedObjects());
      if (selected.length) {
        const members = selected.map(o => records.find(s => normalize(seatLabel(s)) === normalize(objectLabel(o))));
        const chosen = members.every(Boolean) && group(members as SeatRecord[], selected, quotes, true);
        next = chosen ? { ready: true, groups: [chosen] } : { ready: true, groups: [], problem: 'Giỏ có ghế khác. Kiểm tra đơn.' };
      } else {
        const groups: SeatGroup[] = [];
        const report = entry.chart.getReportBySelectability ? await bounded(entry.chart.getReportBySelectability()) : undefined;
        let insufficient = false;
        const objects = new Map<string, Promise<SeatObject | undefined>>();
        const get = (seat: SeatRecord) => {
          const label = seatLabel(seat);
          if (!objects.has(label)) objects.set(label, bounded(entry.chart.findObject(label)).catch(error => {
            if (error instanceof Error && error.message === 'sdk-timeout') throw error;
            return undefined;
          }));
          return objects.get(label)!;
        };
        for (const quote of quotes) {
          const count = report?.selectable?.byCategoryLabel?.[quote.name];
          if (Number.isInteger(count) && count! >= 0 && count! < quantity) { insufficient ||= count! > 0; continue; }
          const plans = seatPlans(records.filter(s => s.ticketClassId === quote.id), quantity);
          let found: SeatGroup | undefined;
          for (let i = 0; i < plans.length && !found; i += 8) {
            if (disposed || current !== entry || entry.revision !== revision) return;
            const batch = await Promise.all(plans.slice(i, i + 8).map(async plan => {
              const items = await Promise.all(plan.map(get));
              if (items.some(o => !o || o.selectable !== true || o.forSale === false || !['free', 'available'].includes(o.status ?? ''))) return;
              return group(plan, items as SeatObject[], quotes, false);
            }));
            found = batch.find(Boolean);
          }
          if (!found && quantity > 1) {
            const available: SeatRecord[] = [];
            for (const seat of records.filter(s => s.ticketClassId === quote.id)) {
              const object = await get(seat);
              if (object?.selectable === true && object.forSale !== false && ['free', 'available'].includes(object.status ?? '')) available.push(seat);
              const members = available.filter(s => s.zoneId === seat.zoneId);
              if (members.length === quantity) {
                found = group(members, await Promise.all(members.map(get)) as SeatObject[], quotes, false);
                if (found) break;
              }
            }
          }
          if (found) { groups.push(found); break; }
        }
        next = { ready: true, groups, ...(!groups.length ? { note: insufficient ? `Không đủ ${quantity} ghế trong hạng đã chọn. Đang chờ ghế.` : 'Chưa có ghế phù hợp. Đang chờ ghế.' } : {}) };
      }
      entry.readFailures = 0;
    } catch {
      entry.readFailures++;
      next = { ready: false, groups: [], ...(entry.readFailures >= 3
        ? { problem: 'Sơ đồ không phản hồi sau 3 lần đọc. Kiểm tra tab vé; chưa gửi chọn ghế.' }
        : { note: 'Sơ đồ chưa phản hồi. Đang kết nối lại.' }) };
    }
    finally {
      if (entry.revision === revision) { entry.state = next; entry.at = Date.now(); }
      entry.loading = false; if (current === entry) changed();
    }
  }
  const listener = (event: Event) => {
    let request: { requestId: string; eventId: string; calendarId: string; quantity: number; quotes: SeatQuote[]; choose?: SeatGroup };
    try { request = JSON.parse((event as CustomEvent<string>).detail); } catch { return; }
    if (!request || !validId(request.requestId) || !validId(request.eventId) || !validId(request.calendarId) || !Number.isInteger(request.quantity) || request.quantity < 1 || request.quantity > 10 ||
      !Array.isArray(request.quotes) || !request.quotes.length || request.quotes.length > 20 || request.quotes.some(q => !q || !validId(q.id) || !short(q.name)) ||
      view.location.hostname !== 'ticket.1zone.vn' || !/^\/booking\/[^/]+\/?$/.test(view.location.pathname) || new URL(view.location.href).searchParams.get('calendarId') !== request.calendarId) return;
    const eventName = `${view.location.pathname.split('/')[2]}-${request.calendarId}`;
    const chart = findChart(eventName);
    const records = inventory.get(`${request.eventId}/${request.calendarId}`);
    const key = `${request.eventId}/${request.calendarId}|${request.quantity}|${JSON.stringify(request.quotes)}`;
    if (!chart || !records) {
      view.document.dispatchEvent(new view.CustomEvent(SEATS_REPLY, { detail: JSON.stringify({ requestId: request.requestId, ready: false, groups: [], note: !chart ? 'Đang kết nối sơ đồ ghế.' : 'Đang chờ dữ liệu ghế từ website.' }) })); return;
    }
    if (!current || current.key !== key || current.chart !== chart) current = { key, chart, state: { ready: false, groups: [] }, at: 0, loading: false, revision: 0, readFailures: 0 };
    const entry = current;
    const cached = entry.state.groups.filter(g => g.selected).flatMap(g => g.labels);
    if (!entry.state.pending && Array.isArray(chart.selectedObjects) && (cached.length !== chart.selectedObjects.length || cached.some(s => !chart.selectedObjects.includes(s)))) {
      entry.state = { ready: false, groups: [] }; entry.at = 0;
    }
    if (request.choose && !entry.state.pending && !entry.state.problem) {
      const choice = entry.state.groups.find(g => !g.selected && !g.unavailable && JSON.stringify(g) === JSON.stringify(request.choose));
      if (choice) {
        entry.revision++; const epoch = controlEpoch;
        entry.state = { ...entry.state, pending: true };
        // No session is started by the extension. Select through the site's SDK;
        // its own onObjectSelected callbacks construct the actual booking cart.
        void (async () => {
          try {
            const existing = await bounded(chart.listSelectedObjects());
            if (disposed || epoch !== controlEpoch) return;
            if (existing.length || chart !== findChart(eventName) || view.location.pathname.split('/')[2] + '-' + new URL(view.location.href).searchParams.get('calendarId') !== eventName) throw new Error('changed');
            const available = await bounded(Promise.all(choice.labels.map(label => chart.findObject(label))));
            if (disposed || epoch !== controlEpoch) return;
            if (available.some(o => !o.selectable || o.forSale === false || !['free', 'available'].includes(o.status ?? ''))) {
              entry.state = { ready: true, groups: [{ ...choice, unavailable: true }], retrySafe: true }; return;
            }
            await bounded(chart.doSelectObjects(choice.labels), 5000);
            entry.state = { ...entry.state, pending: false }; entry.at = 0;
            if (!entry.loading) await refresh(entry, records, request.quotes, request.quantity);
          } catch {
            try {
              const selected = await bounded(chart.listSelectedObjects());
              if (selected.length === choice.labels.length && selected.every(o => choice.labels.includes(o.label))) {
                entry.state = { ready: true, groups: [{ ...choice, selected: true }] }; entry.at = 0;
              } else entry.state = { ready: true, groups: [], problem: selected.length ? 'Ghế đã đổi. Kiểm tra giỏ trên website.' : 'Chọn ghế chưa được xác nhận. Kiểm tra tab vé.' };
            } catch { entry.state = { ready: true, groups: [], problem: 'Chưa rõ kết quả chọn ghế. Kiểm tra tab vé.' }; }
          } finally { entry.state.pending = false; if (entry.at !== 0) entry.at = Date.now(); changed(); }
        })();
      }
    } else if (!request.choose && !entry.state.problem && Date.now() - entry.at > (entry.readFailures ? 1000 : 250)) void refresh(entry, records, request.quotes, request.quantity);
    view.document.dispatchEvent(new view.CustomEvent(SEATS_REPLY, { detail: JSON.stringify({ requestId: request.requestId, ...entry.state }) }));
  };
  const cancel = () => { controlEpoch++; current = undefined; };
  view.document.addEventListener(SEATS_REQUEST, listener);
  view.document.addEventListener(SEATS_CANCEL, cancel);
  const cleanup = () => {
    disposed = true; controlEpoch++; view.document.removeEventListener(SEATS_REQUEST, listener); view.document.removeEventListener(SEATS_CANCEL, cancel);
    if (view.fetch === wrappedFetch) view.fetch = originalFetch;
    if (view.XMLHttpRequest.prototype.open === wrappedOpen) view.XMLHttpRequest.prototype.open = xhrOpen;
    if (view.XMLHttpRequest.prototype.send === wrappedSend) view.XMLHttpRequest.prototype.send = xhrSend;
  };
  view.__campSeatsCleanup = cleanup;
  return cleanup;
}
