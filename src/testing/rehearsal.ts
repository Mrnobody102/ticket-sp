import type { TaskConfig } from '../core/models';
import type { FixtureName } from './fixtures';
import { installBookingDemo } from './booking-demo';
import { installOnezoneDemo } from './onezone-demo';
import { validatePreferences } from '../core/preferences';

/** Local-only test data: no Chrome storage or server calls. */
export function createRehearsal(document: Document, name: FixtureName, quantity: number): TaskConfig {
  const style = document.createElement('style');
  style.textContent = 'body{font:14px Segoe UI,sans-serif;color:#20252c;background:#fff;margin:24px}main{margin-left:344px;max-width:560px}h1{font-size:21px}article,.ticket-card,[role=dialog]{border:1px solid #dbe1e8;border-radius:6px;padding:16px;margin:12px 0}button,select,input{font:inherit;padding:9px 12px;border:1px solid #cbd4e1;border-radius:4px}button{cursor:pointer}button:disabled{cursor:default;color:#8792a0}button:focus-visible{outline:2px solid #2458ae}canvas{border:1px dashed #999} @media(max-width:700px){main{margin:0 0 440px}}';
  document.head.append(style);
  if (name === 'booking') installBookingDemo(document);
  if (name === 'onezone-modal') installOnezoneDemo(document);
  return {
    schemaVersion: 1, enabled: true, panelVisible: true,
    preferences: validatePreferences({
      platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/local-demo?calendarId=demo',
      saleStartAt: new Date(Date.now() - 1000).toISOString(), quantity,
      preferredZoneLabels: name === 'onezone-modal' ? ['HAI QUÝ - EB'] : ['VIP', 'Khu A', 'A1', 'A2'],
      allowAlternatives: false,
      catalog: name === 'onezone-modal' ? {
        eventId: 'demo', performanceId: 'demo', title: 'Diễn tập 1Zone', venue: 'Mô phỏng',
        startsAt: '2030-01-01T00:00:00Z', verifiedAt: Date.now(), maxQuantity: 2,
        tickets: [{ id: 'demo-hai-quy', name: 'HAI QUÝ - EB', priceVnd: 2996000, seatMode: 'AUTO', maxQuantity: 2 }],
      } : undefined,
    }),
  };
}
