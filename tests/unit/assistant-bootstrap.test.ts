import { describe, expect, it } from 'vitest';
import { loadAssistantState } from '../../src/application/assistant-bootstrap';
import { DEFAULT_CONFIG } from '../../src/core/models';
import type { AutoRun } from '../../src/core/automation';

const config = { ...DEFAULT_CONFIG, panelVisible: true };
const run: AutoRun = { id: 'run', tabId: 1, revision: 0, preferencesKey: 'test', startedAt: 1, expiresAt: 2, progress: { phase: 'READY', message: '' } };

describe('khởi tạo panel trên tab vé', () => {
  it('giữ cấu hình/phiên khi đọc thành công', async () => {
    expect(await loadAssistantState(async () => config, async () => run)).toEqual({ config, run, error: undefined });
  });
  it('đọc phiên lỗi: vẫn có panel thụ động, không văng promise hoặc tự chạy', async () => {
    const result = await loadAssistantState(async () => config, async () => { throw new Error('Cần tải lại tiện ích.'); });
    expect(result).toEqual({ config, run: null, error: 'Cần tải lại tiện ích.' });
  });
  it('storage lỗi: không dùng phiên với cấu hình chưa đọc được', async () => {
    const result = await loadAssistantState(async () => { throw new Error('Storage unavailable'); }, async () => run);
    expect(result).toEqual({ config: DEFAULT_CONFIG, run: null, error: 'Storage unavailable' });
  });
  it('rejection không có Error vẫn được hiển thị và chặn automation', async () => {
    const result = await loadAssistantState(async () => config, async () => Promise.reject(undefined));
    expect(result.run).toBeNull(); expect(result.error).toContain('Reload');
    const emptyMessage = await loadAssistantState(async () => config, async () => { throw new Error(''); });
    expect(emptyMessage.run).toBeNull(); expect(emptyMessage.error).toContain('Reload');
  });
});
