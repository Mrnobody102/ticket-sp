import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fixtures, type FixtureName } from '../../testing/fixtures';
import type { AutoRun } from '../../core/automation';
import { preferencesKey } from '../../core/automation';
import { createRehearsal, type RehearsalScenario } from '../../testing/rehearsal';
import { mountAssistant } from '../../ui/mount-assistant';
import '../../ui/styles.css';

function Demo() {
  const [name, setName] = useState<FixtureName>('onezone-modal');
  const [quantity, setQuantity] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [scenario, setScenario] = useState<RehearsalScenario>('normal');
  const [released, setReleased] = useState(false);
  const release = useRef<() => void>(() => undefined);
  const mounted = useRef<ReturnType<typeof mountAssistant> | null>(null);
  const interactive = name === 'booking' || name === 'onezone-modal';
  useEffect(() => () => mounted.current?.destroy(), []);

  function onLoad(event: React.SyntheticEvent<HTMLIFrameElement>) {
    mounted.current?.destroy();
    const doc = event.currentTarget.contentDocument;
    if (!doc) return;
    const rehearsal = createRehearsal(doc, name, quantity, interactive ? scenario : 'normal');
    const { config } = rehearsal;
    release.current = rehearsal.release;
    let run: AutoRun | null = null;
    mounted.current = mountAssistant({
      document: doc, getUrl: () => config.preferences!.eventUrl,
      initialConfig: config, rehearsal: true,
      onStop: async () => { run = null; mounted.current?.updateAuto(null); },
      onHide: async () => undefined, onOpen: async () => undefined,
      automation: interactive ? { transport: {
        start: async () => run = {
          id: crypto.randomUUID(), tabId: 0, revision: 0,
          preferencesKey: preferencesKey(config.preferences!), startedAt: Date.now(), expiresAt: Date.now() + 60000,
          progress: { phase: 'READY', message: 'Đang thử chọn vé.' },
        },
        stop: async () => run = null,
        commit: async (before, progress) => {
          if (!run || run.id !== before.id || run.revision !== before.revision) throw new Error('Bài thử đã được đặt lại.');
          return run = { ...run, revision: run.revision + 1, progress };
        },
      } } : undefined,
    });
    setReady(true);
  }
  function reset(next = name) { setReady(false); setStarted(false); setReleased(false); setName(next); setAttempt(v => v + 1); }
  return <main className="demo">
    <header className="demo-header"><div><h1>Diễn tập</h1><p>Cùng bộ chọn vé với bản thật, trên trang mô phỏng. Không đặt vé hay thanh toán thật.</p></div>
      <a href={chrome.runtime.getURL('/workspace.html')}>Cấu hình đặt vé ↗</a></header>
    <div className="rehearsal-controls">
      <label>Luồng đặt vé<select aria-label="Luồng đặt vé" value={interactive ? name : ''} onChange={e => reset(e.target.value as FixtureName)}>
        {!interactive && <option value="">Đang xem màn hình kiểm tra</option>}
        <option value="onezone-modal">1Zone · Vé tự cấp ghế</option><option value="booking">Chọn khu vực và số lượng</option>
      </select></label>
      <label>Số vé<select aria-label="Số vé" value={quantity} onChange={e => { setQuantity(Number(e.target.value)); reset(); }}><option value="1">1</option><option value="2">2</option></select></label>
      <label>Tình huống<select aria-label="Tình huống" disabled={!interactive} value={scenario} onChange={e => { setScenario(e.target.value as RehearsalScenario); reset(); }}>
        <option value="normal">Mua vé bình thường</option><option value="queue">Có phòng chờ</option><option value="challenge">Cần xác minh</option>
      </select></label>
      <button type="button" className="primary" disabled={!ready || !interactive || started} onClick={() => { setStarted(true); void mounted.current?.startAuto(); }}>Chạy thử</button>
      <button type="button" onClick={() => reset()}>Làm lại</button>
    </div>
    {interactive && scenario !== 'normal' && <div className="rehearsal-gate"><p>{scenario === 'queue' ? 'Tool giữ nguyên phòng chờ. Nút dưới giả lập lúc website cho bạn vào chọn vé.' : 'Tool tạm dừng khi gặp xác minh. Nút dưới giả lập việc bạn xác minh xong và bật camp lại.'}</p>
      <button disabled={!started || released} onClick={() => { release.current(); setReleased(true); if (scenario === 'challenge') void mounted.current?.startAuto(); }}>{scenario === 'queue' ? 'Cho vào chọn vé' : 'Đã xác minh · chạy tiếp'}</button></div>}
    <p className="rehearsal-limit">Bản thật còn phụ thuộc đăng nhập, tồn vé và phản hồi 1Zone. Kết quả diễn tập không xác nhận đã giữ được vé.</p>
    <details className="diagnostic-fixtures"><summary>Kiểm tra nhận diện màn hình</summary>
      <label>Màn hình<select aria-label="Màn hình" value={interactive ? '' : name} onChange={e => { if (e.target.value) reset(e.target.value as FixtureName); }}>
        <option value="">Chọn màn hình</option>{Object.entries(fixtures).filter(([key]) => !['booking', 'onezone-modal'].includes(key)).map(([key, fixture]) => <option key={key} value={key}>{fixture.label}</option>)}
      </select></label><p>Chỉ kiểm tra trạng thái và lựa chọn tool đọc được.</p>
    </details>
    <iframe key={attempt} title="Giao diện concert mô phỏng" srcDoc={fixtures[name].html} onLoad={onLoad} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
