import { version } from '../../package.json';

export const EXTENSION_VERSION = version;
export const RUNTIME_INFO = { version, protocolVersion: 1 } as const;
export const RELOAD_EXTENSION_MESSAGE = 'Mở chrome://extensions → Camp vé → Tải lại. Sau đó tải lại tab 1Zone và mở lại tiện ích.';

/** Normalize stale-worker/disconnected-context errors across all message clients. */
export async function sendToBackground<T>(message: object): Promise<T | undefined> {
  try {
    const reply: unknown = await chrome.runtime.sendMessage(message);
    if (reply && typeof reply === 'object' && 'error' in reply) {
      const legacyDenied = reply.error === 'Lệnh chỉ dùng trong trang cấu hình tiện ích.' &&
        'type' in message && typeof message.type === 'string' && /^(AUTO_(GET|START|STOP|STEP)|RUNTIME_INFO)$/.test(message.type);
      if (reply.error === 'Lệnh không được hỗ trợ.' || legacyDenied) throw new Error(RELOAD_EXTENSION_MESSAGE);
    }
    return reply as T | undefined;
  } catch (error) {
    if (error instanceof Error && /receiving end does not exist|extension context invalidated|message (?:port|channel) closed/i.test(error.message)) {
      throw new Error(RELOAD_EXTENSION_MESSAGE);
    }
    throw error;
  }
}

/** Check only when opening setup, never on the booking action path. */
export async function verifyExtensionRuntime(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const reply = await Promise.race([
      sendToBackground<{ info?: { version?: string; protocolVersion?: number } }>({ type: 'RUNTIME_INFO' }),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(RELOAD_EXTENSION_MESSAGE)), 4000); }),
    ]);
    if (reply?.info?.version !== RUNTIME_INFO.version || reply.info.protocolVersion !== RUNTIME_INFO.protocolVersion) {
      throw new Error(RELOAD_EXTENSION_MESSAGE);
    }
  } finally { clearTimeout(timer); }
}
