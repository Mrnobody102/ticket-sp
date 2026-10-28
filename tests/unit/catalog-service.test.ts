import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ticketReply } from '../fixtures/catalog';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const command = { type: 'CATALOG_TICKETS' as const, platform: 'onezone' as const, eventId: 'event-test', performanceId: 'HN' };

describe('transport chỉ đọc cho catalog', () => {
  it('gộp request đang chờ, cache ngắn và không gửi cookie/token', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(ticketReply()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { handleCatalogCommand } = await import('../../src/infrastructure/catalog-service');
    await Promise.all([handleCatalogCommand(command), handleCatalogCommand(command)]);
    await handleCatalogCommand(command);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/get-summary-event/event-test?'), expect.objectContaining({ method: 'GET', credentials: 'omit', redirect: 'error' }));
    const options = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(options.headers).toBeUndefined();
  });
  it('preflight luôn tải mới, kể cả vừa chọn hạng xong', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ticketReply()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { handleCatalogCommand, getCatalogProvider } = await import('../../src/infrastructure/catalog-service');
    await handleCatalogCommand(command);
    await getCatalogProvider('onezone', true).tickets(command.eventId, command.performanceId);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ cache: 'no-store' }));
    await handleCatalogCommand({ ...command, fresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ cache: 'no-store' }));
  });
  it('không lặp truy cập sau 429 trong một thao tác, cho phép thử lại thủ công', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 429 })); vi.stubGlobal('fetch', fetchMock);
    const { handleCatalogCommand } = await import('../../src/infrastructure/catalog-service');
    await expect(handleCatalogCommand(command)).rejects.toThrow('giới hạn');
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(handleCatalogCommand(command)).rejects.toThrow('giới hạn');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('từ chối nền tảng chưa hỗ trợ, URL/ID và truy vấn ngoài hợp đồng trước network', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const { handleCatalogCommand } = await import('../../src/infrastructure/catalog-service');
    await expect(handleCatalogCommand({ ...command, platform: 'cticket' })).rejects.toThrow('Chưa kết nối');
    await expect(handleCatalogCommand({ ...command, eventId: '../escape' })).rejects.toThrow('ID');
    await expect(handleCatalogCommand({ type: 'CATALOG_DETAIL', platform: 'onezone', url: 'https://evil.com/events/test' })).rejects.toThrow();
    await expect(handleCatalogCommand({ type: 'CATALOG_SEARCH', platform: 'onezone', query: 'x', page: -1 })).rejects.toThrow('trang');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
