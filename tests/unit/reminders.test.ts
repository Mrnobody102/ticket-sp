import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_KEY, NOTIFIED_KEY } from '../../src/infrastructure/storage';
import { reconcileReminder } from '../../src/infrastructure/reminders';
import { reminderKey } from '../../src/core/workflow';
import type { TaskConfig } from '../../src/core/models';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('nhắc giờ qua vòng đời service worker', () => {
  it('dùng dấu storage để không nhắc lặp; bỏ qua cấu hình đã dừng', async () => {
    const at = Date.parse('2026-10-18T05:00:00Z');
    vi.useFakeTimers(); vi.setSystemTime(at);
    const config: TaskConfig = {
      schemaVersion: 1, enabled: true, panelVisible: true,
      preferences: { platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/demo', saleStartAt: new Date(at).toISOString(), quantity: 2, preferredZoneLabels: [], allowAlternatives: false },
    };
    const store: Record<string, unknown> = { [CONFIG_KEY]: config };
    const create = vi.fn(async () => 'notification');
    vi.stubGlobal('chrome', {
      storage: { local: { get: async (key: string) => ({ [key]: store[key] }), set: async (value: object) => { Object.assign(store, value); } } },
      alarms: { clear: vi.fn(async () => true), create: vi.fn() },
      runtime: { getURL: (path: string) => 'chrome-extension://demo' + path },
      notifications: { create }, action: { setBadgeText: vi.fn() },
    });
    await reconcileReminder();
    expect(create).toHaveBeenCalledTimes(1);
    expect(store[NOTIFIED_KEY]).toBe(reminderKey(config.preferences!));
    // A fresh call knows nothing except persisted storage, as after a worker restart.
    await reconcileReminder();
    expect(create).toHaveBeenCalledTimes(1);
    config.enabled = false;
    await reconcileReminder();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
