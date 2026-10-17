import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fixtures, type FixtureName } from '../../testing/fixtures';
import type { TaskConfig } from '../../core/models';
import { DEFAULT_QUANTITY } from '../../core/models';
import { mountAssistant } from '../../ui/mount-assistant';
import '../../ui/styles.css';
import { installBookingDemo } from '../../testing/booking-demo';
import { preferencesKey, type AutoRun } from '../../core/automation';
import { installOnezoneDemo } from '../../testing/onezone-demo';

function Demo() {
  const [name, setName] = useState<FixtureName>('zone');
  const frame = useRef<HTMLIFrameElement>(null);
  const mounted = useRef<ReturnType<typeof mountAssistant> | null>(null);
  const [visible, setVisible] = useState(true);
  const config = useRef<TaskConfig>({
    schemaVersion: 1, enabled: true, panelVisible: true,
    preferences: {
      platform: 'onezone', eventUrl: 'https://ticket.1zone.vn/events/local-demo',
      saleStartAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(), quantity: DEFAULT_QUANTITY,
      preferredZoneLabels: ['VIP', 'Khu A', 'A1', 'A2'], allowAlternatives: false,
    },
  });
  useEffect(() => () => { mounted.current?.destroy(); }, []);
  function onLoad() {
    mounted.current?.destroy();
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const style = doc.createElement('style');
    style.textContent = 'body{font:15px Segoe UI,sans-serif;background:#fff;color:#20312e;margin:26px} main{margin-left:360px;max-width:500px} article{border:1px solid #dce5df;border-radius:12px;padding:16px;margin:12px 0} h3{margin-top:0} button{padding:9px 16px;border:1px solid #cbd8d1;border-radius:8px;background:#f4f8f5;color:#20312e;cursor:pointer} canvas{border:1px dashed #999;background:#f1f4f2} @media(max-width:700px){main{margin:0 0 600px}}';
    doc.head.append(style);
    config.current = { ...config.current, enabled: true, panelVisible: true };
    config.current.preferences = { ...config.current.preferences!, preferredZoneLabels: ['VIP', 'Khu A', 'A1', 'A2'], catalog: undefined,
      saleStartAt: new Date(Date.now() + (['booking', 'onezone-modal'].includes(name) ? -1000 : 180000)).toISOString() };
    if (name === 'booking') installBookingDemo(doc);
    if (name === 'onezone-modal') {
      installOnezoneDemo(doc);
      config.current.preferences = { ...config.current.preferences, preferredZoneLabels: ['HAI QUÝ - EB'],
        catalog: { eventId: 'demo', performanceId: 'demo', title: 'Diễn tập 1Zone', venue: 'Hà Nội', startsAt: '2030-01-01T00:00:00Z', verifiedAt: Date.now(),
          tickets: [{ id: 'demo-hai-quy', name: 'HAI QUÝ - EB', priceVnd: 2996000, seatMode: 'AUTO' }] } };
    }
    let localRun: AutoRun | null = null;
    setVisible(true);
    mounted.current = mountAssistant({
      document: doc, getUrl: () => config.current.preferences!.eventUrl, initialConfig: config.current,
      onStop: async () => { localRun = null; mounted.current?.updateAuto(null); config.current = { ...config.current, enabled: false }; mounted.current?.update(config.current); },
      onHide: async () => { config.current = { ...config.current, panelVisible: false }; mounted.current?.update(config.current); setVisible(false); },
      onOpen: async () => { /* Demo stays local. */ },
      automation: { transport: {
        start: async () => localRun = { id: crypto.randomUUID(), tabId: 0, revision: 0, preferencesKey: preferencesKey(config.current.preferences!), startedAt: Date.now(), expiresAt: Date.now() + 3600000, progress: { phase: 'READY', message: 'Diễn tập camp tự động.' } },
        stop: async () => localRun = null,
        commit: async (run, progress) => {
          if (!localRun || localRun.id !== run.id || localRun.revision !== run.revision) throw new Error('Phiên demo đã đổi.');
          return localRun = { ...localRun, revision: localRun.revision + 1, progress };
        },
      } },
    });
  }
  return <main className="demo">
    <span className="eyebrow">CAMP VÉ / DIỄN TẬP CỤC BỘ</span><h1>Sẵn sàng trước giờ G.</h1>
    <p className="muted">Thử nhận diện, gợi ý và dừng theo dõi. Dữ liệu mô phỏng, không kết nối 1Zone và không sửa cấu hình concert của bạn.</p>
    <div className="toolbar">{Object.entries(fixtures).map(([key, fixture]) => <button key={key} aria-pressed={key === name} onClick={() => setName(key as FixtureName)}>{fixture.label}</button>)}
      {!visible && <button onClick={() => { config.current = { ...config.current, panelVisible: true }; mounted.current?.update(config.current); setVisible(true); }}>Hiện panel</button>}
    </div>
    <iframe ref={frame} title="Giao diện concert mô phỏng" srcDoc={fixtures[name].html} onLoad={onLoad} style={{ width: '100%', height: 760, border: '1px solid #dce5df', borderRadius: 16, background: '#fff' }} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
