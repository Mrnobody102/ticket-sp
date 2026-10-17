import { DEFAULT_CONFIG, type TaskConfig } from '../core/models';
import type { AutoRun } from '../core/automation';

/** A failed session read must leave a visible, passive panel instead of an unhandled promise. */
export async function loadAssistantState(loadConfig: () => Promise<TaskConfig>, loadRun: () => Promise<AutoRun | null>) {
  const [config, run] = await Promise.allSettled([Promise.resolve().then(loadConfig), Promise.resolve().then(loadRun)]);
  const failed = config.status === 'rejected' ? config : run.status === 'rejected' ? run : undefined;
  const error = !failed ? undefined : failed.reason instanceof Error && failed.reason.message ? failed.reason.message : 'Không đọc được tiện ích. Reload tiện ích và tải lại tab vé.';
  return {
    config: config.status === 'fulfilled' ? config.value : { ...DEFAULT_CONFIG },
    run: !failed && run.status === 'fulfilled' ? run.value : null,
    error,
  };
}
