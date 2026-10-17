import type { AutoProgress, AutoRun } from '../core/automation';

export type AutoCommand = { type: 'AUTO_GET' } | { type: 'AUTO_START' } | { type: 'AUTO_STOP' } |
  { type: 'AUTO_STEP'; id: string; revision: number; progress: AutoProgress };
export async function autoCommand(message: AutoCommand): Promise<AutoRun | null> {
  const reply = await chrome.runtime.sendMessage(message) as { run?: AutoRun | null; error?: string } | undefined;
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
