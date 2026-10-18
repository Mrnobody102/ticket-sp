import { RUNTIME_INFO } from './extension-runtime';

export const EVENT_RUNTIME_ERROR = 'Tab vé chưa nhận bản Camp vé mới. Tải lại tab vé rồi bấm Bắt đầu camp.';

async function probe(tabId: number): Promise<{ info?: { version?: string; protocolVersion?: number } } | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      chrome.tabs.sendMessage(tabId, { type: 'CONTENT_READY' }, { frameId: 0 }).catch(() => undefined),
      new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), 500); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Setup only: never report an armed run without a compatible content script. */
export async function ensureEventRuntime(tabId: number): Promise<void> {
  const deadline = Date.now() + 8000;
  do {
    const reply = await probe(tabId);
    if (reply?.info) {
      if (reply.info.version === RUNTIME_INFO.version && reply.info.protocolVersion === RUNTIME_INFO.protocolVersion) return;
      throw new Error(EVENT_RUNTIME_ERROR);
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  } while (Date.now() < deadline);
  throw new Error(EVENT_RUNTIME_ERROR);
}
