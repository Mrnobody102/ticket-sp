/** Synthetic modal with public 1Zone markers, never an authenticated session clone. */
export function installOnezoneDemo(document: Document, options: { checkoutDelayMs?: number } = {}) {
  const list = document.querySelector('#ticket-list');
  const host = document.querySelector('#modal-host');
  if (!list || !host) return;
  list.querySelector('button')!.addEventListener('click', () => {
    host.innerHTML = '<div role="dialog"><h2>Chọn số lượng vé</h2><p>HAI QUÝ - EB</p><div><div><s>3.500.000 ₫</s><span>2.996.000 ₫</span></div><div><button data-id="btn-sub" aria-label="Giảm số lượng" disabled>−</button><span>1</span><button data-id="btn-add" aria-label="Tăng số lượng">+</button></div></div><footer><p>Tổng cộng: <span data-total>2.996.000 ₫</span></p><button data-id="btn-continue">Tiếp tục</button></footer></div>';
    const count = host.querySelector('[data-id="btn-add"]')!.previousElementSibling!;
    const total = host.querySelector('[data-total]')!;
    const plus = host.querySelector<HTMLButtonElement>('[data-id="btn-add"]')!;
    const minus = host.querySelector<HTMLButtonElement>('[data-id="btn-sub"]')!;
    const update = (delta: number) => {
      const value = Number(count.textContent) + delta;
      count.textContent = String(value); total.textContent = `${(2996000 * value).toLocaleString('vi-VN')} ₫`;
      minus.disabled = value === 1; plus.disabled = value === 2;
    };
    plus.addEventListener('click', () => update(1)); minus.addEventListener('click', () => update(-1));
    host.querySelector('[data-id="btn-continue"]')!.addEventListener('click', () => {
      const finish = () => { host.innerHTML = `<h1>Thanh toán</h1><form><p>HAI QUÝ - EB · ${count.textContent} vé · Mô phỏng</p><button type="button">Xác nhận đơn hàng</button></form>`; };
      if (options.checkoutDelayMs) document.defaultView!.setTimeout(finish, options.checkoutDelayMs);
      else finish();
    });
  });
}
