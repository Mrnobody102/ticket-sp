import type { EventPreferences, TaskConfig } from '../core/models';
import { sendToBackground } from './extension-runtime';

export type Command =
  | { type: 'SAVE'; preferences: EventPreferences }
  | { type: 'ENABLE'; enabled: boolean }
  | { type: 'PANEL'; visible: boolean }
  | { type: 'OPEN_EVENT' }
  | { type: 'OPEN_DEMO' }
  | { type: 'OPEN_WORKSPACE' };

export async function command(message: Command): Promise<TaskConfig> {
  const reply = await sendToBackground<{ config?: TaskConfig; error?: string }>(message);
  if (!reply?.config) throw new Error(reply?.error ?? 'Mất kết nối tiện ích. Tải lại trang sau khi cập nhật extension.');
  return reply.config;
}
