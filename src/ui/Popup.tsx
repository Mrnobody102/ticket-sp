import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CONFIG, DEFAULT_QUANTITY, type TaskConfig } from '../core/models';
import { fromVietnamLocal, toVietnamLocal, validatePreferences, money, isSameEvent } from '../core/preferences';
import { repository, watchConfig } from '../infrastructure/storage';
import { command, type Command } from '../infrastructure/messages';
import { autoCommand } from '../infrastructure/automation-messages';
import { autoActive, hasUnresolvedReservation, type AutoRun } from '../core/automation';
import { platformForUrl } from '../core/platform-catalog';
import { EventFinder, type LoadedConcert } from './EventFinder';
import { TicketPriorities } from './TicketPriorities';
import { CAPITANEUS_PRESET, HANOI_PRESET } from '../core/task-presets';
import { catalogQuantityLimit } from '../core/catalog-validation';
import { EXTENSION_VERSION, verifyExtensionRuntime } from '../infrastructure/extension-runtime';
import { emptyBookingDraft, type BookingDraft } from '../core/booking-draft';
import { clearBookingDraft, loadBookingDraft, saveBookingDraft } from '../infrastructure/booking-draft';
import { getCampJournal } from '../infrastructure/camp-journal';
import { saveCampReport } from './save-camp-report';

const isOnSale = (value: LoadedConcert) => value.performance.saleStatus === 'OPEN' ||
  (value.detail.performances.length === 1 && value.detail.status === 'OPEN');

export function Popup({ workspace = false }: { workspace?: boolean }) {
  const [config, setConfig] = useState<TaskConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const controlBusy = useRef(false);
  const [dirty, setDirtyState] = useState(false);
  const dirtyRef = useRef(false);
  function setDirty(next: boolean) { dirtyRef.current = next; setDirtyState(next); }
  const [form, setForm] = useState(emptyBookingDraft);
  const formRef = useRef(form);
  const baseKey = useRef('');
  const initialized = useRef(false);
  const { url, saleTime, immediate, strictSchedule, quantity, budget, labels, alternatives, loaded, selectedTickets, retainedCatalog, refreshAtSale, manualMode } = form;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [autoRun, setAutoRun] = useState<AutoRun | null>(null);
  const [requestedUrl, setRequestedUrl] = useState<{ url: string; requestId: number }>();
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeError, setRuntimeError] = useState('');
  const draftEvent = useRef('');
  function edit(patch: Partial<BookingDraft>, markDirty = true) {
    const next = { ...formRef.current, ...patch }; formRef.current = next; setForm(next);
    if (markDirty) setDirty(true);
    if (initialized.current) void saveBookingDraft(baseKey.current, next, dirtyRef.current).catch(() => setError('Không lưu được bản nháp. Bấm Lưu cấu hình trước khi đóng.'));
  }

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
    void repository.load().then(async stored => {
      if (!active) return;
      const c = latest ?? stored; latest = c;
      const savedDraft = await loadBookingDraft(JSON.stringify(c.preferences)).catch(() => null);
      if (!active) return;
      const currentConfig = latest ?? c; setConfig(currentConfig);
      baseKey.current = JSON.stringify(currentConfig.preferences);
      const p = currentConfig.preferences;
      let initial = emptyBookingDraft();
      if (p) {
        initial = { ...initial, url: p.eventUrl, saleTime: toVietnamLocal(p.saleStartAt), immediate: p.startMode === 'IMMEDIATE', strictSchedule: p.startMode === undefined, quantity: String(p.quantity),
          budget: p.maxTotalVnd ? String(p.maxTotalVnd) : '', labels: p.preferredZoneLabels.join('\n'), alternatives: p.allowAlternatives,
          retainedCatalog: p.catalog, refreshAtSale: p.refreshAtSale === true, manualMode: !p.catalog && p.preferredZoneLabels.length > 0 };
      }
      if (savedDraft && baseKey.current === JSON.stringify(c.preferences)) { initial = savedDraft.form; setDirty(savedDraft.dirty); }
      // Older drafts can contain OPEN detail without performance.saleStatus.
      // An empty schedule must not prevent buying a show that is already on sale.
      if (!initial.saleTime && initial.loaded && isOnSale(initial.loaded)) initial = { ...initial, immediate: true };
      draftEvent.current = initial.url; formRef.current = initial; setForm(initial); initialized.current = true;
      setReady(true);
    }).catch(() => { if (active) setError('Không đọc được cấu hình. Đóng và mở lại tiện ích.'); });
    return () => { active = false; initialized.current = false; unwatch(); chrome.storage.onChanged.removeListener(onSessionChanged); };
  }, []);
  async function send(message: Command, rollback?: TaskConfig) {
    setBusy(true); setError(''); setNotice('');
    try { setConfig(await command(message)); } catch (e) {
      if (rollback) setConfig(rollback);
      setError(e instanceof Error ? e.message : 'Không thể thực hiện.');
    } finally { setBusy(false); }
  }
  async function save(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const startImmediately = immediate || (!saleTime && !!loaded && isOnSale(loaded));
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
        platform: platformForUrl(url.trim())?.id, eventUrl: url.trim(), saleStartAt: startImmediately ? new Date().toISOString() : fromVietnamLocal(saleTime),
        ...(startImmediately ? { startMode: 'IMMEDIATE' } : !strictSchedule ? { startMode: 'WHEN_AVAILABLE' } : {}), quantity: Number(quantity),
        maxTotalVnd: budget.trim() ? Number(budget) : undefined,
        preferredZoneLabels: labels.split('\n').map(v => v.trim()).filter(Boolean), allowAlternatives: alternatives, catalog, refreshAtSale,
      });
      const saved = await command({ type: 'SAVE', preferences }); setConfig(saved); baseKey.current = JSON.stringify(saved.preferences);
      const next = { ...formRef.current, immediate: startImmediately, retainedCatalog: catalog }; formRef.current = next; setForm(next); setDirty(false);
      await clearBookingDraft().catch(() => undefined); // Saved preferences already invalidate an older draft's base key.
      setNotice('Đã lưu cấu hình.'); setAutoRun(null);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể lưu cấu hình.'); return false; }
    finally { setBusy(false); }
  }
  async function startOrStopAuto() {
    if (controlBusy.current) return;
    controlBusy.current = true;
    setBusy(true); setError('');
    try {
      if (!autoActive(autoRun) && !hasUnresolvedReservation(autoRun) && (dirtyRef.current || !config.preferences)) {
        const form = document.getElementById('camp-setup-form') as HTMLFormElement;
        if (!form.reportValidity() || !await save()) return;
        setBusy(true);
      }
      setAutoRun(await autoCommand({ type: !autoActive(autoRun) && hasUnresolvedReservation(autoRun) ? 'AUTO_FOCUS' : autoActive(autoRun) ? 'AUTO_STOP' : 'AUTO_START' }));
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Không bắt đầu được camp.'); }
    finally { controlBusy.current = false; setBusy(false); }
  }
  async function openRunTab() {
    setBusy(true); setError('');
    try {
      if (autoRun) await autoCommand({ type: 'AUTO_FOCUS' });
      else await command({ type: 'OPEN_EVENT' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Không mở được tab vé.'); }
    finally { setBusy(false); }
  }
  async function exportJournal() {
    try {
      const journal = await getCampJournal();
      if (!journal) throw new Error('Chưa có nhật ký camp. Bật camp để ghi tự động.');
      saveCampReport(document, { capturedAt: new Date().toISOString(), version: EXTENSION_VERSION, scope: 'Local diagnostic history; actions are attempts, not server confirmation', journal });
    } catch (e) { setError(e instanceof Error ? e.message : 'Không lưu được nhật ký.'); }
  }
  function resetConcert(targetUrl?: string) {
    const patch: Partial<BookingDraft> = { loaded: null, retainedCatalog: undefined, selectedTickets: [], manualMode: false };
    if (targetUrl && (!draftEvent.current || !isSameEvent(targetUrl, draftEvent.current))) {
      // Performance time is not sale time. Unknown sale dates stay empty.
      const preset = isSameEvent(targetUrl, CAPITANEUS_PRESET.eventUrl) ? CAPITANEUS_PRESET : isSameEvent(targetUrl, HANOI_PRESET.eventUrl) ? HANOI_PRESET : undefined;
      Object.assign(patch, { saleTime: preset && Date.parse(preset.saleStartAt) > Date.now() ? toVietnamLocal(preset.saleStartAt) : '', immediate: false, strictSchedule: false,
        quantity: String(DEFAULT_QUANTITY), budget: '', alternatives: false, refreshAtSale: true });
    }
    if (targetUrl) { draftEvent.current = targetUrl; patch.url = targetUrl; }
    edit(patch);
  }
  function loadConcert(value: LoadedConcert) {
    const integration = platformForUrl(value.detail.url)?.integration;
    if (!integration) return;
    const target = integration.withPerformance(new URL(value.detail.url), value.performance.id);
    edit({ url: target.href, loaded: value, retainedCatalog: undefined, selectedTickets: [], labels: '', manualMode: false,
      ...(isOnSale(value) && !formRef.current.saleTime ? { immediate: true } : {}) });
    setNotice(''); setError('');
  }
  const running = autoActive(autoRun);
  const current = loaded?.detail.title ?? retainedCatalog?.title;
  const quantityLimit = catalogQuantityLimit(loaded?.performance.maxQuantity ?? retainedCatalog?.maxQuantity,
    loaded ? loaded.catalog.tickets.filter(t => selectedTickets.includes(t.id)) : retainedCatalog?.tickets ?? []);
  function useTarget() {
    draftEvent.current = CAPITANEUS_PRESET.eventUrl;
    edit({ url: CAPITANEUS_PRESET.eventUrl, saleTime: Date.parse(CAPITANEUS_PRESET.saleStartAt) > Date.now() ? toVietnamLocal(CAPITANEUS_PRESET.saleStartAt) : '', immediate: false, strictSchedule: false, quantity: String(CAPITANEUS_PRESET.quantity),
      budget: '', alternatives: false, refreshAtSale: true, labels: '', manualMode: false, loaded: null, retainedCatalog: undefined, selectedTickets: [] });
    setError(''); setNotice(''); setRequestedUrl({ url: CAPITANEUS_PRESET.eventUrl, requestId: Date.now() });
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
      {ready && <EventFinder initialDraft={form.finder} onDraftChange={finder => edit({ finder }, false)} requestedUrl={requestedUrl} saved={retainedCatalog} shortcut={{ title: CAPITANEUS_PRESET.title, description: '22/11 · TP.HCM · 1 vé', onChoose: useTarget }} onLoad={loadConcert} onReset={resetConcert} />}
      <form id="camp-setup-form" className="setup-form" onSubmit={e => void save(e)}>
        <div className="section-title"><h2>Vé và giờ bán</h2><span>{dirty ? 'Bản nháp' : config.preferences ? 'Đã lưu' : ''}</span></div>
        {loaded ? <TicketPriorities key={loaded.performance.id} tickets={loaded.catalog.tickets} selected={selectedTickets} onChange={selectedTickets => edit({ selectedTickets })} /> :
          retainedCatalog ? <div className="saved-tickets"><b>Hạng vé đã lưu</b><ol>{retainedCatalog.tickets.map(t => <li key={t.id}>{t.name}<span>{money(t.priceVnd)}</span></li>)}</ol><button className="subtle-button" type="button" onClick={reloadTickets}>Tải hạng vé để thay đổi lựa chọn</button></div> :
            <section className="catalog-needed" aria-label="Danh sách hạng vé"><span>Chọn sự kiện để tải hạng vé.</span>{url.trim() && <button type="button" onClick={reloadTickets}>Tải hạng vé</button>}</section>}
        <div className="booking-fields">
          <label>Số vé<input aria-label="Số vé" type="number" min="1" max={Math.min(100, quantityLimit ?? 100)} step="1" required value={quantity} onChange={e => edit({ quantity: e.target.value })} />{quantityLimit !== undefined && <small>Tối đa {quantityLimit}</small>}</label>
          <label>Bắt đầu<select aria-label="Cách bắt đầu camp" value={immediate ? 'IMMEDIATE' : strictSchedule ? 'SCHEDULED' : 'WHEN_AVAILABLE'} onChange={e => edit({ immediate: e.target.value === 'IMMEDIATE', strictSchedule: e.target.value === 'SCHEDULED' })}><option value="WHEN_AVAILABLE">Theo giờ và khi web mở</option><option value="SCHEDULED">Chỉ đúng giờ đã đặt</option><option value="IMMEDIATE">Ngay khi bật camp</option></select>{!immediate && !strictSchedule && <small>Chạy sớm nếu website cho mua.</small>}</label>
        </div>
        {!immediate && <label>Giờ mở bán · UTC+7<input aria-label="Giờ mở bán · giờ Việt Nam (UTC+7)" type="datetime-local" required={!loaded || !isOnSale(loaded)} value={saleTime} onChange={e => edit({ saleTime: e.target.value })} />{!saleTime && <small>{loaded && isOnSale(loaded) ? 'Show đang bán. Để trống để camp ngay.' : 'Nguồn chưa cung cấp giờ mở bán. Nhập giờ ban tổ chức công bố.'}</small>}</label>}
        <details className="event-link" open={!current}><summary>Link sự kiện</summary><label><span className="sr-only">Link concert</span><input type="url" required value={url} onChange={e => { draftEvent.current = ''; edit({ url: e.target.value, loaded: null, retainedCatalog: undefined, manualMode: false, immediate: false, saleTime: '', selectedTickets: [] }); }} placeholder="https://ticket.1zone.vn/events/…" /></label><button type="button" className="subtle-button" disabled={!url.trim()} onClick={reloadTickets}>Tải chi tiết từ link</button></details>
        <details className="extra-settings"><summary>Ngân sách và cách chọn vé</summary>
          <label>Tổng ngân sách (VNĐ)<input type="number" min="1" step="1" value={budget} onChange={e => edit({ budget: e.target.value })} placeholder="Không giới hạn" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={alternatives} onChange={e => edit({ alternatives: e.target.checked })} />Cho phép mua hạng ngoài danh sách ưu tiên</label>
          {alternatives && <small>Chỉ chọn trong ngân sách đã đặt. Để trống nghĩa là không giới hạn giá.</small>}
          <label className="checkbox-label"><input type="checkbox" checked={refreshAtSale} onChange={e => edit({ refreshAtSale: e.target.checked })} />Kiểm tra mở bán khi trang chưa cập nhật</label>
          {!loaded && !retainedCatalog && <><label className="checkbox-label"><input type="checkbox" checked={manualMode} onChange={e => edit({ manualMode: e.target.checked })} />Nhập hạng vé thủ công</label>
            {manualMode && <label>Hạng vé ưu tiên · mỗi dòng một hạng<textarea value={labels} onChange={e => edit({ labels: e.target.value })} placeholder={'VIP\nKhu A'} /><small>Chỉ dùng khi nguồn không cung cấp danh sách. Tên phải khớp hạng hiển thị trên website.</small></label>}</>}
        </details>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="success" role="status">{notice}</p>}
        <details className="display-settings"><summary>Trang vé và hiển thị</summary><div className="button-row">
          <button type="button" disabled={busy || !config.preferences} onClick={() => void openRunTab()}>{running ? 'Đến tab đang camp' : autoRun ? 'Đến tab vé' : 'Mở trang vé'}</button>
          <button type="button" onClick={() => void exportJournal()}>Lưu nhật ký camp</button>
          <button type="button" disabled={busy || !config.preferences} onClick={() => void send({ type: 'ENABLE', enabled: !config.enabled })}>{config.enabled ? 'Tắt công cụ trên trang vé' : 'Bật công cụ trên trang vé'}</button>
        </div><label className="checkbox-label"><input type="checkbox" checked={config.panelVisible} disabled={!ready || busy} onChange={e => {
          const previous = config; setConfig({ ...config, panelVisible: e.target.checked }); void send({ type: 'PANEL', visible: e.target.checked }, previous);
        }} />Hiện bảng camp trên trang vé</label></details>
      </form>
    </div>
    <footer className="run-bar"><div className="run-summary"><b>{running ? 'Đang camp' : autoRun?.progress.phase === 'CHECKOUT' ? 'Đã tới thanh toán' : dirty ? 'Bản nháp' : config.preferences ? 'Đã lưu' : 'Chọn sự kiện'}</b>{autoRun && <p>{autoRun.progress.message}</p>}</div>
      <div className="run-controls"><button type="submit" form="camp-setup-form" disabled={!ready || !runtimeReady || busy || !hasSelection || hasUnresolvedReservation(autoRun)}>{busy ? 'Đang xử lý…' : 'Lưu cấu hình'}</button>
        <button type="button" className={running ? 'danger-button' : 'primary'} disabled={!ready || busy || (!running && !hasUnresolvedReservation(autoRun) && (!runtimeReady || !(dirty ? hasSelection : !!config.preferences)))} onClick={() => void startOrStopAuto()}>{running ? 'Dừng camp' : hasUnresolvedReservation(autoRun) ? 'Kiểm tra tab vé' : dirty && hasSelection ? 'Lưu và camp' : 'Bắt đầu camp'}</button></div>
    </footer>
  </main>;
}
