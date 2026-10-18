import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CONFIG, DEFAULT_QUANTITY, type TaskConfig } from '../core/models';
import type { CatalogSelection } from '../core/catalog';
import { fromVietnamLocal, toVietnamLocal, validatePreferences, money, isSameEvent } from '../core/preferences';
import { repository, watchConfig } from '../infrastructure/storage';
import { command, type Command } from '../infrastructure/messages';
import { autoCommand } from '../infrastructure/automation-messages';
import { autoActive, type AutoRun } from '../core/automation';
import { platformForUrl } from '../core/platform-catalog';
import { EventFinder, type LoadedConcert } from './EventFinder';
import { TicketPriorities } from './TicketPriorities';
import { HANOI_PRESET } from '../core/task-presets';
import { catalogQuantityLimit } from '../core/catalog-validation';
import { EXTENSION_VERSION, verifyExtensionRuntime } from '../infrastructure/extension-runtime';

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
  const [requestedUrl, setRequestedUrl] = useState<{ url: string; requestId: number }>();
  const [refreshAtSale, setRefreshAtSale] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeError, setRuntimeError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const draftEvent = useRef('');

  useEffect(() => {
    let active = true;
    let latest: TaskConfig | undefined;
    void verifyExtensionRuntime().then(() => { if (active) setRuntimeReady(true); }).catch(e => {
      if (active) setRuntimeError(e instanceof Error ? e.message : 'Không kết nối được tiện ích. Tải lại tiện ích trong chrome://extensions.');
    });
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
        draftEvent.current = p.eventUrl;
        setUrl(p.eventUrl); setSaleTime(toVietnamLocal(p.saleStartAt)); setQuantity(String(p.quantity));
        setBudget(p.maxTotalVnd ? String(p.maxTotalVnd) : ''); setLabels(p.preferredZoneLabels.join('\n')); setAlternatives(p.allowAlternatives); setRetainedCatalog(p.catalog); setRefreshAtSale(p.refreshAtSale === true);
        setManualMode(!p.catalog && p.preferredZoneLabels.length > 0);
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
      if (!loaded && !catalog && !manualMode) throw new Error('Tải hạng vé từ sự kiện rồi chọn ít nhất một hạng ưu tiên.');
      if (loaded) {
        if (!selectedTickets.length) throw new Error('Thêm ít nhất một hạng vé ưu tiên.');
        const { detail, performance, catalog: source } = loaded;
        catalog = { eventId: detail.id, performanceId: performance.id, title: detail.title, venue: performance.venue, startsAt: performance.startsAt,
          verifiedAt: source.fetchedAt, maxQuantity: performance.maxQuantity, tickets: selectedTickets.map(id => {
            const ticket = source.tickets.find(t => t.id === id);
            if (!ticket) throw new Error('Hạng vé đã đổi. Tải lại danh sách.');
            return { id: ticket.id, name: ticket.name, priceVnd: ticket.priceVnd, zoneName: ticket.zoneName, zones: ticket.zones, seatMode: ticket.seatMode, maxQuantity: ticket.maxQuantity };
          }) };
      }
      const preferences = validatePreferences({
        platform: platformForUrl(url.trim())?.id, eventUrl: url.trim(), saleStartAt: fromVietnamLocal(saleTime), quantity: Number(quantity),
        maxTotalVnd: budget.trim() ? Number(budget) : undefined,
        preferredZoneLabels: labels.split('\n').map(v => v.trim()).filter(Boolean), allowAlternatives: alternatives, catalog, refreshAtSale,
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
  function resetConcert(targetUrl?: string) {
    if (targetUrl && (!draftEvent.current || !isSameEvent(targetUrl, draftEvent.current))) {
      // Performance time is not sale time. Unknown sale dates stay empty.
      const preset = isSameEvent(targetUrl, HANOI_PRESET.eventUrl) ? HANOI_PRESET : undefined;
      setSaleTime(preset ? toVietnamLocal(preset.saleStartAt) : '');
      setQuantity(String(DEFAULT_QUANTITY)); setBudget(''); setAlternatives(false); setRefreshAtSale(!!preset);
    }
    if (targetUrl) { draftEvent.current = targetUrl; setUrl(targetUrl); }
    setLoaded(null); setRetainedCatalog(undefined); setSelectedTickets([]); setManualMode(false); setDirty(true);
  }
  function loadConcert(value: LoadedConcert) {
    const integration = platformForUrl(value.detail.url)?.integration;
    if (!integration) return;
    const target = integration.withPerformance(new URL(value.detail.url), value.performance.id);
    setUrl(target.href); setLoaded(value); setRetainedCatalog(undefined); setSelectedTickets([]); setLabels(''); setManualMode(false); setDirty(true); setNotice(''); setError('');
  }
  const running = autoActive(autoRun);
  const current = loaded?.detail.title ?? retainedCatalog?.title;
  const quantityLimit = catalogQuantityLimit(loaded?.performance.maxQuantity ?? retainedCatalog?.maxQuantity,
    loaded ? loaded.catalog.tickets.filter(t => selectedTickets.includes(t.id)) : retainedCatalog?.tickets ?? []);
  function useTarget() {
    draftEvent.current = HANOI_PRESET.eventUrl;
    setUrl(HANOI_PRESET.eventUrl); setSaleTime(toVietnamLocal(HANOI_PRESET.saleStartAt)); setQuantity(String(HANOI_PRESET.quantity));
    setBudget(''); setAlternatives(false); setRefreshAtSale(true); setLabels(''); setManualMode(false); setLoaded(null); setRetainedCatalog(undefined); setSelectedTickets([]);
    setDirty(true); setError(''); setNotice(''); setRequestedUrl({ url: HANOI_PRESET.eventUrl, requestId: Date.now() });
  }
  function reloadTickets() { setRequestedUrl({ url, requestId: Date.now() }); }
  const hasSelection = loaded ? selectedTickets.length > 0 : !!retainedCatalog || (manualMode && !!labels.trim());
  return <main className={workspace ? 'popup workspace' : 'popup'}>
    <header className="app-header"><div className="app-title"><h1>Camp vé</h1><span className="app-version">v{EXTENSION_VERSION}</span></div><nav>
      {!workspace && <a className="button-link" href={chrome.runtime.getURL('/workspace.html')} target="_blank" rel="noreferrer">Mở rộng ↗</a>}
      <a className="button-link" href={chrome.runtime.getURL('/demo.html')} target="_blank" rel="noreferrer">Diễn tập</a>
      <a className="button-link" href={chrome.runtime.getURL('/huong-dan.html')} target="_blank" rel="noreferrer">Hướng dẫn</a>
    </nav></header>
    {runtimeError && <aside className="runtime-notice error" role="alert"><b>Cần tải lại tiện ích</b><p>{runtimeError}</p></aside>}
    <div className="setup-grid" inert={busy || !ready || !runtimeReady}>
      <EventFinder requestedUrl={requestedUrl} saved={retainedCatalog} shortcut={{ title: HANOI_PRESET.title, description: 'Hà Nội · 12:00 · 18/10/2026 · tự tải hạng/giá', onChoose: useTarget }} onLoad={loadConcert} onReset={resetConcert} />
      <form id="camp-setup-form" className="setup-form" onSubmit={e => void save(e)}>
        <div className="section-title"><h2>Vé và giờ bán</h2><span>{dirty ? 'Chưa lưu' : config.preferences ? 'Đã lưu' : ''}</span></div>
        {loaded ? <TicketPriorities key={loaded.performance.id} tickets={loaded.catalog.tickets} selected={selectedTickets} onChange={ids => { setSelectedTickets(ids); setDirty(true); }} /> :
          retainedCatalog ? <div className="saved-tickets"><b>Hạng vé đã lưu</b><ol>{retainedCatalog.tickets.map(t => <li key={t.id}>{t.name}<span>{money(t.priceVnd)}</span></li>)}</ol><button className="subtle-button" type="button" onClick={reloadTickets}>Tải hạng vé để thay đổi lựa chọn</button></div> :
            <section className="catalog-needed" aria-label="Danh sách hạng vé"><span>Chọn sự kiện để tải hạng vé.</span>{url.trim() && <button type="button" onClick={reloadTickets}>Tải hạng vé</button>}</section>}
        <div className="booking-fields">
          <label>Số vé<input aria-label="Số vé" type="number" min="1" max={Math.min(100, quantityLimit ?? 100)} step="1" required value={quantity} onChange={e => { setQuantity(e.target.value); setDirty(true); }} />{quantityLimit !== undefined && <small>Tối đa {quantityLimit}</small>}</label>
          <label>Giờ mở bán · UTC+7<input aria-label="Giờ mở bán · giờ Việt Nam (UTC+7)" type="datetime-local" required value={saleTime} onChange={e => { setSaleTime(e.target.value); setDirty(true); }} />{!saleTime && <small>Nhập giờ mở bán do ban tổ chức công bố.</small>}</label>
        </div>
        <details className="event-link" open={!current}><summary>Link sự kiện</summary><label><span className="sr-only">Link concert</span><input type="url" required value={url} onChange={e => { setUrl(e.target.value); setLoaded(null); setRetainedCatalog(undefined); setManualMode(false); setDirty(true); }} placeholder="https://ticket.1zone.vn/events/…" /></label><button type="button" className="subtle-button" disabled={!url.trim()} onClick={reloadTickets}>Tải chi tiết từ link</button></details>
        <details className="extra-settings"><summary>Ngân sách và cách chọn vé</summary>
          <label>Tổng ngân sách (VNĐ)<input type="number" min="1" step="1" value={budget} onChange={e => { setBudget(e.target.value); setDirty(true); }} placeholder="Không giới hạn" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={alternatives} onChange={e => { setAlternatives(e.target.checked); setDirty(true); }} />Cho phép mua hạng ngoài danh sách ưu tiên</label>
          {alternatives && <small>Chỉ chọn trong ngân sách đã đặt. Để trống nghĩa là không giới hạn giá.</small>}
          <label className="checkbox-label"><input type="checkbox" checked={refreshAtSale} onChange={e => { setRefreshAtSale(e.target.checked); setDirty(true); }} />Tải lại một lần lúc mở bán nếu trang còn khóa</label>
          {!loaded && !retainedCatalog && <><label className="checkbox-label"><input type="checkbox" checked={manualMode} onChange={e => { setManualMode(e.target.checked); setDirty(true); }} />Nhập hạng vé thủ công</label>
            {manualMode && <label>Hạng vé ưu tiên · mỗi dòng một hạng<textarea value={labels} onChange={e => { setLabels(e.target.value); setDirty(true); }} placeholder={'VIP\nKhu A'} /><small>Chỉ dùng khi nguồn không cung cấp danh sách. Tên phải khớp hạng hiển thị trên website.</small></label>}</>}
        </details>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="success" role="status">{notice}</p>}
        <details className="display-settings"><summary>Trang vé và hiển thị</summary><div className="button-row">
          <button type="button" disabled={busy || !config.preferences} onClick={() => void send({ type: 'OPEN_EVENT' })}>Mở trang vé</button>
          <button type="button" disabled={busy || !config.preferences} onClick={() => void send({ type: 'ENABLE', enabled: !config.enabled })}>{config.enabled ? 'Tắt công cụ trên trang vé' : 'Bật công cụ trên trang vé'}</button>
        </div><label className="checkbox-label"><input type="checkbox" checked={config.panelVisible} disabled={!ready || busy} onChange={e => {
          const previous = config; setConfig({ ...config, panelVisible: e.target.checked }); void send({ type: 'PANEL', visible: e.target.checked }, previous);
        }} />Hiện bảng camp trên trang vé</label></details>
      </form>
    </div>
    <footer className="run-bar"><div className="run-summary"><b>{running ? 'Đang camp' : autoRun?.progress.phase === 'CHECKOUT' ? 'Đã tới thanh toán' : dirty ? 'Chưa lưu' : config.preferences ? 'Đã lưu' : 'Chọn sự kiện'}</b>{autoRun && <p>{autoRun.progress.message}</p>}</div>
      <div className="run-controls"><button type="submit" form="camp-setup-form" disabled={!ready || !runtimeReady || busy || !hasSelection}>{busy ? 'Đang xử lý…' : 'Lưu cấu hình'}</button>
        <button type="button" className={running ? 'danger-button' : 'primary'} disabled={!ready || busy || (!running && (!runtimeReady || !config.preferences || dirty))} onClick={() => void startOrStopAuto()}>{running ? 'Dừng camp' : 'Bắt đầu camp'}</button></div>
    </footer>
  </main>;
}
