import type { AutoProgress, AutoRun } from '../core/automation';
import { sendToBackground } from './extension-runtime';

export type AutoCommand = { type: 'AUTO_GET' } | { type: 'AUTO_FOCUS' } | { type: 'AUTO_START' } | { type: 'AUTO_START_HERE' } | { type: 'AUTO_STOP' } |
  { type: 'AUTO_STEP'; id: string; revision: number; progress: AutoProgress };
export async function autoCommand(message: AutoCommand): Promise<AutoRun | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = ['AUTO_START', 'AUTO_START_HERE'].includes(message.type) ? 30000 : 8000;
  const reply = await Promise.race([
    sendToBackground<{ run?: AutoRun | null; error?: string }>(message),
    new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Bộ camp không phản hồi. Kiểm tra tab vé; không tự gửi lại thao tác.')), timeout); }),
  ]).finally(() => clearTimeout(timer));
  if (!reply || reply.error || !('run' in reply)) throw new Error(reply?.error ?? 'Mất kết nối bộ camp. Tải lại tab.');
  return reply.run ?? null;
}

/** Session storage remains private to background; content scripts receive only their run. */
export function watchAutoRun(callback: (run: AutoRun | null) => void): () => void {
  const listener = (message: unknown, sender: chrome.runtime.MessageSender) => {
    if (sender.id === chrome.runtime.id && message && typeof message === 'object' && 'type' in message && message.type === 'AUTO_UPDATED' && 'run' in message) {
      callback(message.run as AutoRun | null);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
