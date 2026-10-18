import type Konva from 'konva';

/** Synthetic booking page, using the same public Konva node attributes as 1Zone. */
export function installOnezoneMapDemo(document: Document, verification = false) {
  const view = document.defaultView!;
  const K = (view as unknown as { Konva: typeof Konva }).Konva;
  const stage = new K.Stage({ container: 'seatmap-container-event-test-fixture', width: 400, height: 220 });
  const layer = new K.Layer(); stage.add(layer);
  const host = document.querySelector('#modal-host')!;
  const main = document.querySelector('main')!;
  const zones = [
    { id: 'ga-a', name: 'GA A', ticketClassId: 'ga-test', disabled: true },
    { id: 'ga-b', name: 'GA B', ticketClassId: 'ga-test', disabled: false },
    { id: 'fan-a', name: 'FANZONE A', ticketClassId: 'fan-test', disabled: false },
  ];
  zones.forEach((zone, index) => layer.add(new K.Path({ x: index * 120 + 10, y: 10, data: 'M0 0 L100 0 L100 100 L0 100 Z',
    fill: zone.disabled ? '#777' : '#acd', name: 'seat', zoneId: zone.id, ticketClassId: zone.ticketClassId, text: zone.name, disabled: zone.disabled })));
  layer.draw();
  stage.on('click', event => {
    const attrs = event.target.attrs;
    if (attrs.disabled || attrs.name !== 'seat') return;
    const zone = zones.find(z => z.id === attrs.zoneId)!;
    main.setAttribute('data-selections', String(Number(main.getAttribute('data-selections') ?? 0) + 1));
    const price = zone.ticketClassId === 'ga-test' ? 900000 : 1500000;
    host.innerHTML = '<div role="dialog"><h2>Chọn số lượng vé</h2><p data-name></p><div><div><span data-price></span></div><div><button data-id="btn-sub" disabled>−</button><span>1</span><button data-id="btn-add">+</button></div></div><div data-verification></div><footer><button data-id="btn-continue">Tiếp tục</button></footer></div>';
    host.querySelector('[data-name]')!.textContent = zone.name;
    host.querySelector('[data-price]')!.textContent = `đ${price.toLocaleString('vi-VN')}`;
    const plus = host.querySelector<HTMLButtonElement>('[data-id="btn-add"]')!;
    const minus = host.querySelector<HTMLButtonElement>('[data-id="btn-sub"]')!;
    const count = plus.previousElementSibling!;
    plus.addEventListener('click', () => { count.textContent = String(Number(count.textContent) + 1); minus.disabled = false; plus.disabled = count.textContent === '4'; });
    minus.addEventListener('click', () => { count.textContent = String(Number(count.textContent) - 1); minus.disabled = count.textContent === '1'; plus.disabled = false; });
    const advance = host.querySelector<HTMLButtonElement>('[data-id="btn-continue"]')!;
    if (verification) {
      advance.disabled = true;
      host.querySelector('[data-verification]')!.innerHTML = '<iframe title="Widget containing a Cloudflare security challenge" style="width:280px;height:60px"></iframe><button data-test-verified>Xác minh xong · mô phỏng</button>';
      host.querySelector('[data-test-verified]')!.addEventListener('click', () => { advance.disabled = false; });
    }
    advance.addEventListener('click', () => {
      main.setAttribute('data-advances', String(Number(main.getAttribute('data-advances') ?? 0) + 1));
      host.innerHTML = `<h1>Thanh toán</h1><form><p>${zone.name} · ${count.textContent} vé</p><button type="button">Xác nhận đơn hàng</button></form>`;
    });
  });
}
