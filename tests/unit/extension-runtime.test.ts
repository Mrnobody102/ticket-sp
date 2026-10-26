import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RELOAD_EXTENSION_MESSAGE, RUNTIME_INFO, verifyExtensionRuntime } from '../../src/infrastructure/extension-runtime';
import { command } from '../../src/infrastructure/messages';
import { autoCommand } from '../../src/infrastructure/automation-messages';
import { catalogClient } from '../../src/infrastructure/catalog-client';

const sendMessage = vi.fn();
beforeEach(() => { sendMessage.mockReset(); vi.stubGlobal('chrome', { runtime: { sendMessage } }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('giao diện và tiến trình nền cùng phiên bản', () => {
  it('AUTO_STEP mất phản hồi: hết deadline, không treo runner hoặc gửi lại lệnh', async () => {
    vi.useFakeTimers(); sendMessage.mockImplementation(() => new Promise(() => undefined));
    const assertion = expect(autoCommand({ type: 'AUTO_GET' })).rejects.toThrow('không phản hồi');
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    expect(sendMessage).toHaveBeenCalledOnce();
  });
  it('chấp nhận đúng build/protocol và chỉ gửi một lệnh kiểm tra', async () => {
    sendMessage.mockResolvedValue({ info: RUNTIME_INFO });
    await expect(verifyExtensionRuntime()).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: 'RUNTIME_INFO' });
  });
  it.each([
    {},
    { info: { ...RUNTIME_INFO, version: '0.0.1' } },
    { info: { ...RUNTIME_INFO, protocolVersion: 0 } },
  ])('thiếu hoặc lệch handshake: hướng dẫn reload, không coi là sẵn sàng', async reply => {
    sendMessage.mockResolvedValue(reply);
    await expect(verifyExtensionRuntime()).rejects.toThrow(RELOAD_EXTENSION_MESSAGE);
  });
  it.each([
    () => command({ type: 'OPEN_WORKSPACE' }),
    () => autoCommand({ type: 'AUTO_GET' }),
    () => catalogClient.search('Vương Bình'),
  ])('lỗi worker cũ có hướng dẫn rõ ở mọi message client', async request => {
    sendMessage.mockResolvedValue({ error: 'Lệnh không được hỗ trợ.' });
    await expect(request()).rejects.toThrow(RELOAD_EXTENSION_MESSAGE);
  });
  it('context mất kết nối sau cập nhật cũng hướng dẫn reload', async () => {
    sendMessage.mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'));
    await expect(autoCommand({ type: 'AUTO_GET' })).rejects.toThrow(RELOAD_EXTENSION_MESSAGE);
  });
  it('worker không trả lời: hết hạn kiểm tra, không giữ giao diện chờ vô hạn', async () => {
    vi.useFakeTimers(); sendMessage.mockImplementation(() => new Promise(() => undefined));
    const assertion = expect(verifyExtensionRuntime()).rejects.toThrow(RELOAD_EXTENSION_MESSAGE);
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
  });
  it('giữ nguyên lỗi nghiệp vụ, không biến mọi lỗi thành cập nhật extension', async () => {
    sendMessage.mockResolvedValue({ error: 'Hạng vé hoặc giá đã đổi.' });
    await expect(command({ type: 'OPEN_EVENT' })).rejects.toThrow('Hạng vé hoặc giá đã đổi.');
  });
  it('worker cũ từ chối AUTO_GET từ content: hướng dẫn reload', async () => {
    sendMessage.mockResolvedValue({ error: 'Lệnh chỉ dùng trong trang cấu hình tiện ích.' });
    await expect(autoCommand({ type: 'AUTO_GET' })).rejects.toThrow(RELOAD_EXTENSION_MESSAGE);
  });
  it('không đổi lỗi quyền SAVE thành lỗi phiên bản', async () => {
    sendMessage.mockResolvedValue({ error: 'Lệnh chỉ dùng trong trang cấu hình tiện ích.' });
    await expect(command({ type: 'SAVE', preferences: {} as never })).rejects.toThrow('Lệnh chỉ dùng trong trang cấu hình tiện ích.');
  });
});
