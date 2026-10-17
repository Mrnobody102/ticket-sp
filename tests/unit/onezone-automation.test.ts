import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { inspectPlatform, adapterForUrl } from '../../src/platforms/registry';
import { inspectAutoControls, executeAutoAction } from '../../src/platforms/onezone-automation';
import { inspectOnezonePage } from '../../src/platforms/onezone';
import type { EventPreferences } from '../../src/core/models';

const p: EventPreferences = { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo', saleStartAt: new Date(0).toISOString(), quantity: 1, preferredZoneLabels: [], allowAlternatives: false };
const progress = { phase: 'READY' as const, message: '' };
const read = () => inspectAutoControls(document, inspectOnezonePage(document, new URL(p.eventUrl)), p, progress);
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  document.body.innerHTML = readFileSync('fixtures/booking.html', 'utf8');
});
describe('hợp đồng adapter và thao tác 1Zone', () => {
  it('registry chọn adapter theo URL; nền tảng chưa tích hợp không có executor', () => {
    expect(adapterForUrl(new URL(p.eventUrl))?.platform).toBe('onezone');
    expect(inspectPlatform(document, new URL('https://example.com/event')).automation).toBeUndefined();
    expect(inspectPlatform(document, new URL(p.eventUrl), { preferences: p, progress }).automation).toBeDefined();
  });
  it('đọc thuần, chỉ thao tác khi executor được gọi', () => {
    const click = vi.fn(); document.querySelector('article button')!.addEventListener('click', click);
    const before = document.body.innerHTML;
    const result = read();
    expect(document.body.innerHTML).toBe(before);
    expect(click).not.toHaveBeenCalled();
    executeAutoAction({ kind: 'CHOOSE', optionId: result.page.selectable[0]! }, result.bindings);
    expect(click).toHaveBeenCalledOnce();
  });
  it('cập nhật input bằng native setter và phát input/change cho website', () => {
    const result = read(); const input = document.querySelector('input')!;
    const changed = vi.fn(); input.addEventListener('change', changed);
    executeAutoAction({ kind: 'QUANTITY', value: 2 }, result.bindings);
    expect(input.value).toBe('2'); expect(changed).toHaveBeenCalledOnce();
  });
  it('đọc select có nhãn và không chọn giá trị website không cung cấp', () => {
    document.querySelector('input')!.outerHTML = '<select><option value="1">1</option><option value="2">2</option></select>';
    const result = read();
    executeAutoAction({ kind: 'QUANTITY', value: 2 }, result.bindings);
    expect(document.querySelector('select')!.value).toBe('2');
    expect(() => executeAutoAction({ kind: 'QUANTITY', value: 3 }, result.bindings)).toThrow();
  });
  it('đọc ARIA spinbutton, bấm nút tăng một lần', () => {
    document.querySelector('label')!.outerHTML = '<div role="group"><button aria-label="Giảm số lượng">−</button><div role="spinbutton" aria-label="Số lượng vé" aria-valuenow="1" aria-valuemin="1" aria-valuemax="2"></div><button aria-label="Tăng số lượng">+</button></div>';
    const result = read(); const increase = vi.fn();
    document.querySelector('[aria-label="Tăng số lượng"]')!.addEventListener('click', increase);
    expect(result.page.quantity).toMatchObject({ value: 1, min: 1, max: 2, stepper: true });
    executeAutoAction({ kind: 'QUANTITY', value: 2 }, result.bindings);
    expect(increase).toHaveBeenCalledOnce();
  });
  it('không nhận nút thanh toán cuối, điều khiển ẩn hoặc liên kết khác suất', () => {
    document.body.innerHTML += '<button>Thanh toán</button><button>Xác nhận đơn hàng</button><button hidden>Tiếp tục</button><a href="https://ticket.1zone.vn/booking/demo?calendarId=HCM">Mua vé</a>';
    const target = { ...p, eventUrl: p.eventUrl + '?calendarId=HN' };
    const result = inspectAutoControls(document, inspectOnezonePage(document, new URL(target.eventUrl)), target, progress);
    expect(result.page.advanceCount).toBe(0); expect(result.page.enterCount).toBe(0);
  });
  it('phát hiện đăng nhập và lỗi giữ chỗ', () => {
    document.body.innerHTML += '<h2>Đăng nhập</h2><input type="password">';
    expect(read().page.problem).toContain('Đăng nhập');
    document.body.innerHTML = '<h1>Phiên đặt vé đã hết hạn</h1>';
    expect(read().page.problem).toContain('hết hạn');
  });
  it('nhận link checkout gốc và add-ons nhưng từ chối host khác', () => {
    document.querySelector('main > button')?.remove();
    document.body.innerHTML += '<a href="https://ticket.1zone.vn/checkout?orderId=test">Tiếp tục</a>';
    expect(read().page.advanceCount).toBe(1);
    document.querySelector('a')!.setAttribute('href', 'https://ticket.1zone.vn/checkout/add-ons?orderId=test');
    expect(read().page.advanceCount).toBe(1);
    document.querySelector('a')!.setAttribute('href', 'https://evil.com/checkout?orderId=test');
    expect(read().page.advanceCount).toBe(0);
  });
  it('đọc aria-pressed và từ chối control đã bị gỡ trước khi thực thi', () => {
    const button = document.querySelector('article button')!; button.setAttribute('aria-pressed', 'true');
    expect(read().page.snapshot.visibleOptions[0]?.selected).toBe(true);
    const result = read(); button.remove();
    expect(() => executeAutoAction({ kind: 'CHOOSE', optionId: result.page.selectable[0]! }, result.bindings)).toThrow();
  });
});
