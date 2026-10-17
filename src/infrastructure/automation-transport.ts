import type { AutomationTransport } from '../application/automation-runner';
import { autoCommand } from './automation-messages';

export const chromeAutomationTransport: AutomationTransport = {
  start: () => autoCommand({ type: 'AUTO_START' }),
  stop: () => autoCommand({ type: 'AUTO_STOP' }),
  commit: (run, progress) => autoCommand({ type: 'AUTO_STEP', id: run.id, revision: run.revision, progress }),
};
