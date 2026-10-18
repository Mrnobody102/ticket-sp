import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectOnezonePage, onezoneAdapter } from '../../src/platforms/onezone';

const url = new URL('https://ticket.1zone.vn/events/demo');
function load(name: string) {
  const html = readFileSync(resolve(`fixtures/${name}.html`), 'utf8');
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, 'text/html').documentElement.innerHTML;
}
beforeEach(() => {
  // jsdom has no layout; visibility tests still exercise computed style and ancestors.
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
describe('adapter 1Zone · fixture tổng hợp', () => {
  it.each([
    ['data-id="btn-by-ticket"', 'EVENT_PAGE'],
    ['data-id="btn-by-ticket" disabled', 'NOT_READY'],
    ['data-id="btn-by-ticket" aria-disabled="true"', 'NOT_READY'],
    ['', 'NOT_READY'],
  ])('nút mua %s có ưu tiên đúng so với tiêu đề cũ', (attrs, state) => {
    document.body.innerHTML = `<h1>Sắp mở bán</h1><button ${attrs}>Mua vé</button>`;
    expect(inspectOnezonePage(document, url).snapshot.state).toBe(state);
  });
  it('không chọn giữa hai CTA chính cùng khả dụng', () => {
    document.body.innerHTML = '<h1>Sắp mở bán</h1><button data-id="btn-by-ticket">Mua vé</button><button data-id="btn-by-ticket">Mua vé</button>';
    expect(inspectOnezonePage(document, url).snapshot.state).toBe('NOT_READY');
  });
  it.each([
    ['zone', 'SELECTING', 'ZONE_ONLY', true], ['assigned', 'SELECTING', 'ASSIGNED_SEAT', true],
    ['seats', 'SELECTING', 'PICK_SEAT', true], ['canvas', 'UNKNOWN', 'PICK_SEAT', false],
    ['waiting', 'WAITING_ROOM', 'UNKNOWN', false], ['challenge', 'CHALLENGE', 'UNKNOWN', false],
    ['checkout', 'CHECKOUT', 'UNKNOWN', false], ['not-ready', 'NOT_READY', 'UNKNOWN', true],
    ['unknown', 'UNKNOWN', 'UNKNOWN', false], ['event', 'EVENT_PAGE', 'PICK_SEAT', true],
    ['mixed', 'SELECTING', 'MIXED', true],
  ])('%s → %s / %s', (name, state, selectionMode, supported) => {
    load(name as string);
    expect(onezoneAdapter.inspectVisiblePage(document, url)).toMatchObject({ state, selectionMode, supported });
  });
  it('đọc giá và trạng thái disabled, không sửa DOM', () => {
    load('zone'); const before = document.documentElement.outerHTML;
    const result = onezoneAdapter.inspectVisiblePage(document, url);
    expect(result.visibleOptions).toHaveLength(3);
    expect(result.visibleOptions[0]).toMatchObject({ label: 'VIP', kind: 'ZONE', displayedPriceVnd: 1200000, displayedAvailability: 'AVAILABLE' });
    expect(result.visibleOptions[2]?.displayedAvailability).toBe('UNAVAILABLE');
    expect(result.maxQuantity).toBe(2);
    expect(document.documentElement.outerHTML).toBe(before);
  });
  it('phân biệt từng ghế với khu vực, giữ nhãn khu vực nếu nhóm có khai báo', () => {
    load('seats');
    const group = document.createElement('div'); group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Khu A');
    document.querySelectorAll('main > button').forEach(button => group.append(button));
    document.querySelector('main')!.append(group);
    const result = inspectOnezonePage(document, url);
    expect(result.snapshot.visibleOptions).toHaveLength(3);
    expect(result.snapshot.visibleOptions[0]).toMatchObject({ kind: 'SEAT', zoneLabel: 'Khu A', label: 'A1' });
    expect(result.optionElements[0]?.element.getAttribute('aria-label')).toBe('A1 · 800.000 ₫');
  });
  it('đọc trạng thái đã chọn qua ARIA và cập nhật ở lần nhận diện mới', () => {
    load('seats');
    document.querySelector('main > button')!.setAttribute('aria-checked', 'true');
    expect(onezoneAdapter.inspectVisiblePage(document, url).visibleOptions[0]?.selected).toBe(true);
    document.querySelector('main > button')!.setAttribute('aria-checked', 'false');
    expect(onezoneAdapter.inspectVisiblePage(document, url).visibleOptions[0]?.selected).toBe(false);
  });
  it.each(['section', 'article', 'div'])('không gộp các ghế cùng giá trong %s có tiêu đề thành một hạng vé', tag => {
    load('seats');
    const group = document.createElement(tag);
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Khu A');
    group.innerHTML = '<h3>Khu A</h3>';
    document.querySelectorAll('main > button').forEach(button => group.append(button));
    document.querySelector('main')!.append(group);
    const result = inspectOnezonePage(document, url);
    expect(result.snapshot.visibleOptions.map(o => o.kind)).toEqual(['SEAT', 'SEAT', 'SEAT']);
    expect(result.snapshot.visibleOptions.every(o => o.zoneLabel === 'Khu A')).toBe(true);
    expect(result.optionElements.every(entry => entry.element.tagName === 'BUTTON')).toBe(true);
  });
  it('ưu tiên thông báo chưa mở bán dù điều khiển chọn vé vẫn còn trên trang', () => {
    load('zone');
    document.querySelector('h2')!.textContent = 'Chưa mở bán';
    const result = inspectOnezonePage(document, url);
    expect(result.snapshot).toMatchObject({ state: 'NOT_READY', visibleOptions: [] });
    expect(result.optionElements).toEqual([]);
  });
  it('không giữ cache visibility qua các lần DOM đổi', () => {
    load('zone'); const card = document.querySelector('article')!;
    card.style.display = 'none';
    expect(onezoneAdapter.inspectVisiblePage(document, url).visibleOptions).toHaveLength(2);
    card.style.display = 'block';
    expect(onezoneAdapter.inspectVisiblePage(document, url).visibleOptions).toHaveLength(3);
  });
  it('cấp ghế tự động kèm mô tả không chọn ghế vẫn là assigned', () => {
    load('assigned'); document.body.append(' Không chọn ghế.');
    expect(onezoneAdapter.inspectVisiblePage(document, url).selectionMode).toBe('ASSIGNED_SEAT');
  });
  it('đọc đầy đủ VNĐ, VND, đ và ₫', () => {
    load('assigned');
    const result = onezoneAdapter.inspectVisiblePage(document, url);
    expect(result.visibleOptions.map(o => o.displayedPriceVnd)).toEqual([800000, 500000]);
    document.body.innerHTML = '<button>VIP · 1.200.000 đ</button><button>Khu A · 800.000 ₫</button>';
    expect(onezoneAdapter.inspectVisiblePage(document, url).visibleOptions.map(o => o.label)).toEqual(['VIP', 'Khu A']);
  });
  it.each(['đ2.850.000', '₫2.850.000', 'VNĐ 2.850.000', 'VND 2,850,000'])('đọc giá tiền tố %s mà không gắn giá vào tên hạng vé', price => {
    load('unknown');
    document.body.innerHTML = `<button>HAI QUÝ - GS · ${price}</button>`;
    expect(onezoneAdapter.inspectVisiblePage(document, url).visibleOptions[0])
      .toMatchObject({ label: 'HAI QUÝ - GS', displayedPriceVnd: 2850000 });
  });
  it('không suy ra vé khả dụng từ thẻ giới thiệu hoặc sự kiện tương tự', () => {
    load('public-catalog');
    const snapshot = onezoneAdapter.inspectVisiblePage(document, url);
    expect(snapshot.state).toBe('EVENT_PAGE');
    expect(snapshot.visibleOptions).toEqual([]);
  });
  it('nhận dạng hướng dẫn chọn vị trí chỗ ngồi nhưng không đoán ghế trên canvas', () => {
    load('unknown');
    document.body.innerHTML = '<p>Vui lòng chọn vị trí chỗ ngồi bạn mong muốn trên sơ đồ.</p><canvas width="400" height="200"></canvas>';
    expect(onezoneAdapter.inspectVisiblePage(document, url)).toMatchObject({ state: 'UNKNOWN', selectionMode: 'PICK_SEAT', supported: false });
  });
  it('bỏ DOM ẩn, scripts và các trạng thái chỉ có trong hướng dẫn', () => {
    load('zone');
    document.body.insertAdjacentHTML('beforeend', '<div hidden><h1>Bạn đang trong hàng chờ</h1></div><div style="display:none"><h1>Xác minh bạn là con người</h1></div><script>Thanh toán</script>');
    expect(onezoneAdapter.inspectVisiblePage(document, url).state).toBe('SELECTING');
    load('event');
    document.body.innerHTML += '<form><input aria-label="Đăng nhập" /></form>';
    expect(onezoneAdapter.inspectVisiblePage(document, url).state).toBe('EVENT_PAGE');
  });
  it('không suy đoán giá dải hoặc chọn điều khiển không có nhãn rõ ràng', () => {
    load('unknown'); document.body.innerHTML += '<article><h3>VIP</h3><p>800.000 ₫ – 1.200.000 ₫</p><button>Chọn</button></article>';
    expect(onezoneAdapter.inspectVisiblePage(document, url).visibleOptions).toEqual([]);
  });
  it('không đọc host khác', () => {
    load('zone'); expect(onezoneAdapter.inspectVisiblePage(document, new URL('https://example.com/events/demo')).supported).toBe(false);
  });
});
