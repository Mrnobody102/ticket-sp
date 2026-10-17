import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG, DEFAULT_QUANTITY } from '../core/models';
import type { TaskConfig } from '../core/models';
import { fromVietnamLocal, toVietnamLocal, validatePreferences } from '../core/preferences';
import { repository, watchConfig } from '../infrastructure/storage';
import { command, type Command } from '../infrastructure/messages';

export function Popup() {
  const [config, setConfig] = useState<TaskConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [saleTime, setSaleTime] = useState('');
  const [quantity, setQuantity] = useState(String(DEFAULT_QUANTITY));
  const [budget, setBudget] = useState('');
  const [labels, setLabels] = useState('');
  const [alternatives, setAlternatives] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    let latest: TaskConfig | undefined;
    const unwatch = watchConfig(next => { latest = next; if (active) setConfig(next); });
    void repository.load().then(stored => {
      if (!active) return;
      const c = latest ?? stored;
      setConfig(c); const p = c.preferences;
      if (p) {
        setUrl(p.eventUrl); setSaleTime(toVietnamLocal(p.saleStartAt)); setQuantity(String(p.quantity));
        setBudget(p.maxTotalVnd ? String(p.maxTotalVnd) : ''); setLabels(p.preferredZoneLabels.join('\n')); setAlternatives(p.allowAlternatives);
      }
      setReady(true);
    }).catch(() => { if (active) setError('Không đọc được cấu hình. Thử đóng và mở lại tiện ích.'); });
    return () => { active = false; unwatch(); };
  }, []);
  async function send(message: Command, rollback?: TaskConfig) {
    setBusy(true); setError(''); setNotice('');
    try { setConfig(await command(message)); } catch (e) {
      if (rollback) setConfig(rollback);
      setError(e instanceof Error ? e.message : 'Không thể thực hiện.');
    }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const preferences = validatePreferences({
        platform: 'onezone', eventUrl: url.trim(), saleStartAt: fromVietnamLocal(saleTime), quantity: Number(quantity),
        maxTotalVnd: budget.trim() ? Number(budget) : undefined,
        preferredZoneLabels: labels.split('\n').map(v => v.trim()).filter(Boolean), allowAlternatives: alternatives,
      });
      setConfig(await command({ type: 'SAVE', preferences }));
      setNotice('Đã lưu và bật theo dõi. Mở trang concert để xem panel.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể lưu cấu hình.'); }
    finally { setBusy(false); }
  }
  return <main className="popup">
    <header className="popup-header"><span className="brand-mark">C</span><div><h1>Camp vé</h1><span className="eyebrow">1ZONE ASSISTANT</span></div></header>
    <p className="intro">Sẵn sàng trước giờ mở bán. Lưu concert, chọn ưu tiên và theo dõi ngay trên tab 1Zone.</p>
    <form onSubmit={e => void save(e)}>
      <label>Link concert 1Zone<input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://ticket.1zone.vn/events/…" /></label>
      <label>Giờ mở bán · giờ Việt Nam (UTC+7)<input type="datetime-local" required value={saleTime} onChange={e => setSaleTime(e.target.value)} /><small>Nhập giờ theo thông báo của ban tổ chức.</small></label>
      <div className="field-row">
        <label>Số vé<input type="number" min="1" max="100" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
        <label>Tổng ngân sách (VNĐ)<input type="number" min="1" step="1" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Không giới hạn" /></label>
      </div>
      <label>Hạng vé ưu tiên · mỗi dòng một hạng<textarea value={labels} onChange={e => setLabels(e.target.value)} placeholder={'VIP\nKhu A\nKhu B'} /><small>Đúng tên hiển thị, xếp ưu tiên từ trên xuống. Để trống để xem tất cả.</small></label>
      <label className="checkbox-label"><input type="checkbox" checked={alternatives} onChange={e => setAlternatives(e.target.checked)} />Gợi ý thêm hạng khác trong ngân sách</label>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}
      <button className="primary" type="submit" disabled={!ready || busy}>{busy ? 'Đang xử lý…' : 'Lưu & bật theo dõi'}</button>
      <div className="button-row">
        <button type="button" disabled={busy || !config.preferences} onClick={() => void send({ type: 'OPEN_EVENT' })}>Mở concert đã lưu</button>
        <button type="button" disabled={busy || !config.preferences} onClick={() => void send({ type: 'ENABLE', enabled: !config.enabled })}>{config.enabled ? 'Dừng theo dõi' : 'Tiếp tục theo dõi'}</button>
      </div>
      <label className="checkbox-label"><input type="checkbox" checked={config.panelVisible} disabled={!ready || busy} onChange={e => {
        const previous = config;
        setConfig({ ...config, panelVisible: e.target.checked });
        void send({ type: 'PANEL', visible: e.target.checked }, previous);
      }} />Hiển thị panel trên 1Zone</label>
    </form>
    <footer className="popup-footer"><small>{config.enabled ? '● Đang theo dõi' : '○ Chưa theo dõi'}</small><button className="text-button" disabled={busy} onClick={() => void send({ type: 'OPEN_DEMO' })}>Mở bản diễn tập →</button></footer>
    <p className="footnote">Lưu trên máy này. Bạn tự chọn vé và thanh toán. Nhắc giờ cần Chrome đang chạy, máy không ngủ và thông báo được bật.</p>
  </main>;
}
