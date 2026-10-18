import type { createCampReport } from '../core/camp-report';

export function saveCampReport(document: Document, report: ReturnType<typeof createCampReport>) {
  const view = document.defaultView!;
  const url = view.URL.createObjectURL(new view.Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `camp-ve-${report.capturedAt.replace(/[:.]/g, '-')}.json`;
  document.documentElement.append(link);
  try { link.click(); }
  finally { link.remove(); view.setTimeout(() => view.URL.revokeObjectURL(url), 30000); }
}
