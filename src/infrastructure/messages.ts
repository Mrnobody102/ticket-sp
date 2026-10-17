import type { EventPreferences, TaskConfig } from '../core/models';

export type Command =
  | { type: 'SAVE'; preferences: EventPreferences }
  | { type: 'ENABLE'; enabled: boolean }
  | { type: 'PANEL'; visible: boolean }
  | { type: 'OPEN_EVENT' }
  | { type: 'OPEN_DEMO' };

export async function command(message: Command): Promise<TaskConfig> {
  const reply = await chrome.runtime.sendMessage(message) as { config?: TaskConfig; error?: string } | undefined;
  if (!reply?.config) throw new Error(reply?.error ?? 'Mất kết nối tiện ích. Tải lại trang sau khi cập nhật extension.');
  return reply.config;
}
