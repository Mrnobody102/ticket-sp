import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentBootPending } from '../../src/platforms/document-readiness';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('đợi bootstrap, không đợi media trước cập nhật giờ bán', () => {
  it('HTML còn parse thì chờ; tải xong không chờ', () => {
    const ready = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    expect(documentBootPending(document)).toBe(true);
    ready.mockReturnValue('complete');
    expect(documentBootPending(document)).toBe(false);
  });
  it('ảnh còn pending nhưng DOM có thể dùng thì không khóa F5', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    vi.stubGlobal('performance', { getEntriesByType: () => [] });
    document.body.innerHTML = '<img src="https://ticket.1zone.vn/slow.png">';
    expect(documentBootPending(document)).toBe(false); vi.unstubAllGlobals();
  });
  it('script chưa xong vẫn chờ; script hoàn thành thì media không chặn nữa', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    const entries: { name: string }[] = [];
    vi.stubGlobal('performance', { getEntriesByType: () => entries });
    document.body.innerHTML = '<script src="https://ticket.1zone.vn/app.js"></script><img src="https://ticket.1zone.vn/slow.png">';
    expect(documentBootPending(document)).toBe(true);
    entries.push({ name: 'https://ticket.1zone.vn/app.js' }); expect(documentBootPending(document)).toBe(false);
    vi.unstubAllGlobals();
  });
});
