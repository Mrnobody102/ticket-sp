import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ensureEventRuntime, EVENT_RUNTIME_ERROR } from '../../src/infrastructure/event-runtime';
import { RUNTIME_INFO } from '../../src/infrastructure/extension-runtime';

const sendMessage = vi.fn();
beforeEach(() => { sendMessage.mockReset(); vi.stubGlobal('chrome', { tabs: { sendMessage } }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('kiểm tra tab chính trước khi bật, không thêm request vào mỗi bước chọn vé', async () => {
  sendMessage.mockResolvedValue({ info: RUNTIME_INFO });
  await ensureEventRuntime(42);
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith(42, { type: 'CONTENT_READY' }, { frameId: 0 });
});
it('tab đang nạp: đợi listener rồi tiếp tục', async () => {
  vi.useFakeTimers();
  sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist.')).mockResolvedValue({ info: RUNTIME_INFO });
  const ready = ensureEventRuntime(42);
  await vi.advanceTimersByTimeAsync(150);
  await expect(ready).resolves.toBeUndefined();
});
it('tab cũ: không báo đang camp nếu chưa có runner tương thích', async () => {
  vi.useFakeTimers(); sendMessage.mockRejectedValue(new Error('Receiving end does not exist.'));
  const failed = expect(ensureEventRuntime(42)).rejects.toThrow(EVENT_RUNTIME_ERROR);
  await vi.advanceTimersByTimeAsync(8100); await failed;
});
it('version lệch: yêu cầu tải lại tab ngay', async () => {
  sendMessage.mockResolvedValue({ info: { ...RUNTIME_INFO, version: '0.4.2' } });
  await expect(ensureEventRuntime(42)).rejects.toThrow(EVENT_RUNTIME_ERROR);
});
it('listener không trả lời: vẫn hết hạn, không treo nút Bắt đầu', async () => {
  vi.useFakeTimers(); sendMessage.mockImplementation(() => new Promise(() => undefined));
  const failed = expect(ensureEventRuntime(42)).rejects.toThrow(EVENT_RUNTIME_ERROR);
  await vi.advanceTimersByTimeAsync(9000); await failed;
});
