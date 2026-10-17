import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG, DEFAULT_QUANTITY, type TaskConfig } from '../core/models';
import type { CatalogSelection } from '../core/catalog';
import { fromVietnamLocal, toVietnamLocal, validatePreferences, money } from '../core/preferences';
import { repository, watchConfig } from '../infrastructure/storage';
import { command, type Command } from '../infrastructure/messages';
import { autoCommand } from '../infrastructure/automation-messages';
import { autoActive, type AutoRun } from '../core/automation';
import { platformForUrl } from '../core/platform-catalog';
import { EventFinder, eventDate, type LoadedConcert } from './EventFinder';
import { TicketPriorities } from './TicketPriorities';

export function Popup({ workspace = false }: { workspace?: boolean }) {
  const [config, setConfig] = useState<TaskConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [url, setUrl] = useState('');
  const [saleTime, setSaleTime] = useState('');
  const [quantity, setQuantity] = useState(String(DEFAULT_QUANTITY));
  const [budget, setBudget] = useState('');
  const [labels, setLabels] = useState('');
  const [alternatives, setAlternatives] = useState(false);
  const [loaded, setLoaded] = useState<LoadedConcert | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [retainedCatalog, setRetainedCatalog] = useState<CatalogSelection>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [autoRun, setAutoRun] = useState<AutoRun | null>(null);

  useEffect(() => {
    let active = true;
    let latest: TaskConfig | undefined;
    const unwatch = watchConfig(next => {
      if (active) {
        if (latest && JSON.stringify(latest.preferences) !== JSON.stringify(next.preferences)) setDirty(true);
        setConfig(next);
      }
      latest = next;
    });
    const updateAuto = () => { void autoCommand({ type: 'AUTO_GET' }).then(run => { if (active) setAutoRun(run); }).catch(() => undefined); };
    const onSessionChanged = (_changes: Record<string, chrome.storage.StorageChange>, area: string) => { if (area === 'session') updateAuto(); };
    chrome.storage.onChanged.addListener(onSessionChanged); updateAuto();
    void repository.load().then(stored => {
      if (!active) return;
      const c = latest ?? stored; latest = c; setConfig(c);
      const p = c.preferences;
      if (p) {
        setUrl(p.eventUrl); setSaleTime(toVietnamLocal(p.saleStartAt)); setQuantity(String(p.quantity));
        setBudget(p.maxTotalVnd ? String(p.maxTotalVnd) : ''); setLabels(p.preferredZoneLabels.join('\n')); setAlternatives(p.allowAlternatives); setRetainedCatalog(p.catalog);
      }
      setReady(true);
    }).catch(() => { if (active) setError('Không đọc được cấu hình. Đóng và mở lại tiện ích.'); });
    return () => { active = false; unwatch(); chrome.storage.onChanged.removeListener(onSessionChanged); };
  }, []);
  async function send(message: Command, rollback?: TaskConfig) {
    setBusy(true); setError(''); setNotice('');
    try { setConfig(await command(message)); } catch (e) {
      if (rollback) setConfig(rollback);
      setError(e instanceof Error ? e.message : 'Không thể thực hiện.');
    } finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      let catalog = retainedCatalog;
      if (loaded) {
        if (!selectedTickets.length) throw new Error('Thêm ít nhất một hạng vé ưu tiên.');
        const { detail, performance, catalog: source } = loaded;
        catalog = { eventId: detail.id, performanceId: performance.id, title: detail.title, venue: performance.venue, startsAt: performance.startsAt,
          verifiedAt: source.fetchedAt, tickets: selectedTickets.map(id => {
            const ticket = source.tickets.find(t => t.id === id);
            if (!ticket) throw new Error('Hạng vé đã đổi. Tải lại danh sách.');
            return { id: ticket.id, name: ticket.name, priceVnd: ticket.priceVnd };
          }) };
      }
      const preferences = validatePreferences({
        platform: platformForUrl(url.trim())?.id, eventUrl: url.trim(), saleStartAt: fromVietnamLocal(saleTime), quantity: Number(quantity),
        maxTotalVnd: budget.trim() ? Number(budget) : undefined,
        preferredZoneLabels: labels.split('\n').map(v => v.trim()).filter(Boolean), allowAlternatives: alternatives, catalog,
      });
      setConfig(await command({ type: 'SAVE', preferences })); setRetainedCatalog(catalog); setDirty(false);
      setNotice('Đã lưu cấu hình.'); setAutoRun(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể lưu cấu hình.'); }
    finally { setBusy(false); }
  }
  async function startOrStopAuto() {
    setBusy(true); setError('');
    try { setAutoRun(await autoCommand({ type: autoActive(autoRun) ? 'AUTO_STOP' : 'AUTO_START' })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không bắt đầu được camp.'); }
    finally { setBusy(false); }
  }
  function loadConcert(value: LoadedConcert) {
    const integration = platformForUrl(value.detail.url)?.integration;
    if (!integration) return;
    const target = integration.withPerformance(new URL(value.detail.url), value.performance.id);
    setUrl(target.href); setLoaded(value); setRetainedCatalog(undefined); setSelectedTickets([]); setLabels(''); setDirty(true); setNotice(''); setError('');
  }
  const running = autoActive(autoRun);
  const current = loaded?.detail.title ?? retainedCatalog?.title;
  return <main className={workspace ? 'popup workspace' : 'popup'}>
    <header className="app-header"><div><h1>Camp vé</h1><p>Sự kiện và cấu hình đặt vé</p></div><nav>
      {!workspace && <button type="button" onClick={() => void send({ type: 'OPEN_WORKSPACE' })}>Mở rộng ↗</button>}
      <button type="button" onClick={() => void send({ type: 'OPEN_DEMO' })}>Diễn tập</button>
    </nav></header>
    <div className="setup-grid" inert={busy || !ready}>
      <EventFinder manualUrl={url} onLoad={loadConcert} onReset={() => { setLoaded(null); setRetainedCatalog(undefined); setSelectedTickets([]); setDirty(true); }} />
      <form className="setup-form" onSubmit={e => void save(e)}>
        <div className="section-title"><h2>Cấu hình đặt vé</h2><span>{dirty ? 'Chưa lưu thay đổi' : config.preferences ? 'Đã lưu' : 'Chưa có cấu hình'}</span></div>
        {current && <div className="selected-event"><strong>{current}</strong><span>{loaded?.performance.venue ?? retainedCatalog?.venue}</span><small>{eventDate(loaded?.performance.startsAt ?? retainedCatalog?.startsAt)} · giờ diễn ra</small></div>}
        <label>Link concert<input type="url" required value={url} onChange={e => { setUrl(e.target.value); setLoaded(null); setRetainedCatalog(undefined); setDirty(true); }} placeholder="https://ticket.1zone.vn/events/…" /></label>
        <label>Giờ mở bán · giờ Việt Nam (UTC+7)<input type="datetime-local" required value={saleTime} onChange={e => { setSaleTime(e.target.value); setDirty(true); }} /><small>Nhập giờ bán theo thông báo ban tổ chức.</small></label>
        <div className="field-row">
          <label>Số vé<input type="number" min="1" max={loaded?.performance.maxQuantity ?? 100} step="1" required value={quantity} onChange={e => { setQuantity(e.target.value); setDirty(true); }} /></label>
          <label>Tổng ngân sách (VNĐ)<input type="number" min="1" step="1" value={budget} onChange={e => { setBudget(e.target.value); setDirty(true); }} placeholder="Không giới hạn" /></label>
        </div>
        {loaded ? <TicketPriorities key={loaded.performance.id} tickets={loaded.catalog.tickets} selected={selectedTickets} onChange={ids => { setSelectedTickets(ids); setDirty(true); }} /> :
          retainedCatalog ? <div className="saved-tickets"><b>Hạng vé đã lưu</b><ol>{retainedCatalog.tickets.map(t => <li key={t.id}>{t.name}<span>{money(t.priceVnd)}</span></li>)}</ol><small>Tải lại chi tiết từ link để thay đổi hạng/giá.</small></div> :
            <details className="manual-preferences" open><summary>Nhập hạng vé thủ công</summary><label>Hạng vé ưu tiên · mỗi dòng một hạng<textarea value={labels} onChange={e => { setLabels(e.target.value); setDirty(true); }} placeholder={'VIP\nKhu A'} /><small>Ưu tiên tìm sự kiện để chọn đúng hạng và giá từ nguồn.</small></label></details>}
        <label className="checkbox-label"><input type="checkbox" checked={alternatives} onChange={e => { setAlternatives(e.target.checked); setDirty(true); }} />Cho phép chọn hạng khác trong ngân sách</label>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="success" role="status">{notice}</p>}
        <button className="primary" type="submit" disabled={!ready || busy}>{busy ? 'Đang xử lý…' : 'Lưu & bật theo dõi'}</button>
        <details className="display-settings" open><summary>Trang vé và hiển thị</summary><div className="button-row">
          <button type="button" disabled={busy || !config.preferences} onClick={() => void send({ type: 'OPEN_EVENT' })}>Mở concert đã lưu</button>
          <button type="button" disabled={busy || !config.preferences} onClick={() => void send({ type: 'ENABLE', enabled: !config.enabled })}>{config.enabled ? 'Dừng theo dõi' : 'Tiếp tục theo dõi'}</button>
        </div><label className="checkbox-label"><input type="checkbox" checked={config.panelVisible} disabled={!ready || busy} onChange={e => {
          const previous = config; setConfig({ ...config, panelVisible: e.target.checked }); void send({ type: 'PANEL', visible: e.target.checked }, previous);
        }} />Hiển thị panel trên trang vé</label></details>
      </form>
    </div>
    <footer className="run-bar"><div><b>{running ? 'Camp đang chạy' : autoRun?.progress.phase === 'CHECKOUT' ? 'Đã tới thanh toán' : 'Camp tới thanh toán'}</b><p>{dirty ? 'Lưu cấu hình mới trước khi bắt đầu.' : autoRun?.progress.message ?? (config.preferences ? 'Tự chọn vé theo cấu hình đã lưu.' : 'Chọn sự kiện và lưu cấu hình trước.')}</p></div>
      <button type="button" className={running ? 'danger-button' : 'primary'} disabled={!ready || busy || (!running && (!config.preferences || dirty))} onClick={() => void startOrStopAuto()}>{running ? 'Dừng camp' : 'Bắt đầu camp'}</button>
    </footer>
  </main>;
}
