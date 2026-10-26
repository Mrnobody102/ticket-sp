/** Synthetic SDK contract + website cart UI using observed public 1Zone markers.
 * There are no real hold, auth, verification or payment requests here. */
export async function installOnezoneSeatsDemo(document: Document, options: { quantityDelay?: number; verification?: boolean; wrongTotal?: boolean; readViaXhr?: boolean; rejectSelection?: boolean; onlyAvailableLabel?: string; readHangOnce?: boolean; readHangAlways?: boolean; initialVerification?: boolean } = {}) {
  interface Inventory { _id: string; ticketClassId: string; zoneId: string; zoneName: string; rowName: string; code: string; priceVnd: number }
  interface ObjectValue { id: string; label: string; labels: { section: string; parent: string; own: string }; category: { key: number; label: string }; objectType: string; status: string; selectable: boolean; forSale: boolean }
  const view = document.defaultView! as Window & typeof globalThis & { seatsio: { charts: object[] }; seatDemo: { disable(label: string): void; selects: number; submits: number; paymentClicks: number; orderDelay: number; selectionDelay: number; release(): void } };
  const main = document.querySelector('main')!;
  const url = 'https://prod.1zone.vn/ticketing/api/v4/event/kAapup/tickets?calendarId=XDacU6';
  let payload: { errorCode: number; data: Inventory[] };
  if (options.readViaXhr) payload = await new Promise((resolve, reject) => { const xhr = new view.XMLHttpRequest(); xhr.open('GET', url); xhr.onload = () => resolve(JSON.parse(xhr.responseText)); xhr.onerror = reject; xhr.send(); });
  else payload = await (await view.fetch(url)).json();
  const inventory = payload.data;
  const objects: ObjectValue[] = inventory.map(s => ({ id: `${s.zoneName}-${s.rowName}-${s.code}`, label: `${s.zoneName}-${s.rowName}-${s.code}`,
    labels: { section: s.zoneName, parent: s.rowName, own: s.code }, category: { key: ['WINTER', 'AUTUMN', 'SUMMER', 'SPRING'].indexOf(s.zoneName) + 1, label: s.zoneName }, objectType: 'Seat', status: 'free', selectable: true, forSale: true }));
  const selected: ObjectValue[] = [];
  if (options.onlyAvailableLabel) for (const object of objects) {
    if (object.label !== options.onlyAvailableLabel) { object.selectable = false; object.status = 'booked'; }
  }
  const bar = document.querySelector('.ticket-list-fixed-bar')!;
  let release = () => {};
  const metrics = { selects: 0, submits: 0, paymentClicks: 0, orderDelay: 0, selectionDelay: options.quantityDelay ?? 0, release: () => release(), disable: (label: string) => { const object = objects.find(o => o.label === label); if (object) { object.selectable = false; object.status = 'booked'; } } };
  view.seatDemo = metrics;
  let reads = 0;
  let readBlocked = !!options.readHangAlways;
  Object.assign(metrics, { resumeReads: () => { readBlocked = false; } });
  const chart = {
    config: { event: 'capitaneus-mutabilis-2026-XDacU6', mode: 'normal', session: 'none', onObjectSelected: () => {} }, state: 'RENDERED', selectedObjects: [] as string[],
    container: () => document.querySelector<HTMLElement>('#seatio > div')!,
    listSelectedObjects: async () => {
      reads++;
      if (readBlocked || (options.readHangOnce && reads === 1)) return new Promise<ObjectValue[]>(() => {});
      return selected.map(o => ({ ...o }));
    },
    getReportBySelectability: async () => ({ selectable: { byCategoryLabel: Object.fromEntries(['WINTER', 'AUTUMN', 'SUMMER', 'SPRING'].map(name => [name, objects.filter(o => o.category.label === name && o.selectable).length])) } }),
    findObject: async (label: string) => { const object = objects.find(o => o.label === label); if (!object) throw new Error('not found'); return { ...object }; },
    doSelectObjects: async (labels: string[]) => {
      metrics.selects++; main.setAttribute('data-selections', String(metrics.selects));
      if (metrics.selectionDelay) await new Promise<void>(resolve => { release = resolve; view.setTimeout(resolve, metrics.selectionDelay); });
      if (options.rejectSelection) throw new Error('Unconfirmed selection');
      const chosen = labels.map(l => objects.find(o => o.label === l));
      if (chosen.some(o => !o?.selectable)) throw new Error('Unavailable');
      selected.push(...chosen as ObjectValue[]); chart.selectedObjects = labels;
      const chips = document.createElement('div'); chips.className = 'ticket-scroll';
      for (const o of selected) {
        const record = inventory.find(s => `${s.zoneName}-${s.rowName}-${s.code}` === o.label)!;
        const card = document.createElement('div'); card.innerHTML = `<span>${record.rowName}-${record.code}</span><span>${record.priceVnd.toLocaleString('vi-VN')} ₫</span><button aria-label="Remove ticket">×</button>`;
        chips.append(card);
      }
      const total = selected.reduce((sum, o) => sum + inventory.find(s => `${s.zoneName}-${s.rowName}-${s.code}` === o.label)!.priceVnd, 0) + (options.wrongTotal ? 1 : 0);
      const next = document.createElement('button'); next.textContent = `Thanh toán: ${total.toLocaleString('vi-VN')} ₫`;
      bar.replaceChildren(chips, next);
      const checkout = () => {
        const finish = () => {
          metrics.submits++; main.setAttribute('data-holds', String(metrics.submits));
          main.innerHTML = `<h1>Thanh toán</h1><form><p>${selected[0]!.category.label} · ${selected.length} vé · ${selected.map(o => o.label).join(', ')}</p><button type="button">Xác nhận đơn hàng</button></form>`;
          main.querySelector('form button')!.addEventListener('click', () => metrics.paymentClicks++);
        };
        if (metrics.orderDelay) view.setTimeout(finish, metrics.orderDelay); else finish();
      };
      next.addEventListener('click', () => {
        if (options.verification) {
          const modal = document.createElement('div'); modal.innerHTML = '<h2>Xác minh bạn là con người</h2><iframe title="captcha" srcdoc=""></iframe><button>Xác minh xong · mô phỏng</button>';
          modal.querySelector('button')!.addEventListener('click', () => { modal.remove(); checkout(); }); document.body.append(modal);
        } else checkout();
      });
    },
  };
  view.seatsio = { charts: [chart] };
  if (options.initialVerification) {
    main.hidden = true;
    const gate = document.createElement('section');
    gate.innerHTML = '<h2>Xác minh bạn là con người</h2><iframe title="captcha" srcdoc=""></iframe><button>Xác minh xong · vào chọn ghế</button>';
    gate.querySelector('button')!.addEventListener('click', () => { gate.remove(); main.hidden = false; });
    document.body.append(gate);
  }
  document.dispatchEvent(new view.Event('change', { bubbles: true }));
}
