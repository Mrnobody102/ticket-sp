/** Local demo behavior, separate from the production website adapter. */
export function installBookingDemo(document: Document) {
  const main = document.querySelector('[data-booking-demo]');
  if (!main) return;
  let chosen = '';
  const quantity = main.querySelector<HTMLInputElement>('input[type="number"]')!;
  const next = main.querySelector<HTMLButtonElement>('[data-next]')!;
  const buttons = [...main.querySelectorAll<HTMLButtonElement>('article button')];
  function update() {
    main!.querySelector('[data-cart]')!.textContent = chosen ? `${chosen} · ${quantity.value} vé` : 'Chưa chọn vé.';
    next.disabled = !chosen || !quantity.checkValidity();
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    chosen = button.closest('article')!.querySelector('h3')!.textContent!;
    update();
  }));
  quantity.addEventListener('input', update);
  quantity.addEventListener('change', update);
  next.addEventListener('click', () => {
    if (next.disabled) return;
    main.replaceChildren();
    const title = document.createElement('h1'); title.textContent = 'Thanh toán';
    const form = document.createElement('form');
    const summary = document.createElement('p'); summary.textContent = `${chosen} · ${quantity.value} vé · Bản diễn tập, không tạo giao dịch.`;
    const payment = document.createElement('button'); payment.type = 'button'; payment.textContent = 'Xác nhận đơn hàng';
    payment.addEventListener('click', () => { payment.textContent = 'Đã bấm thanh toán mô phỏng'; });
    form.append(summary, payment); main.append(title, form);
  });
}
