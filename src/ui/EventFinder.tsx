import { useEffect, useRef, useState } from 'react';
import type { CatalogSelection, ConcertDetail, LoadedConcert } from '../core/catalog';
import type { Platform } from '../core/models';
import { catalogClient } from '../infrastructure/catalog-client';
import { money } from '../core/preferences';
import { PLATFORM_CATALOG, platformForCatalogUrl, platformForUrl } from '../core/platform-catalog';
import { emptyFinder, type FinderDraft } from '../core/booking-draft';
import { ATVNCG_PRESET } from '../core/task-presets';

export type { LoadedConcert } from '../core/catalog';
export const eventDate = (value?: string) => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : 'Chưa có lịch';

export function EventFinder({ onLoad, onReset, requestedUrl, shortcut, saved, initialDraft, onDraftChange }: {
  onLoad(value: LoadedConcert): void; onReset(targetUrl?: string): void;
  requestedUrl?: { url: string; requestId: number };
  shortcut?: { title: string; description: string; onChoose(): void };
  saved?: CatalogSelection;
  initialDraft?: FinderDraft;
  onDraftChange?(next: FinderDraft): void;
}) {
  const [draft, setDraft] = useState(initialDraft ?? emptyFinder);
  const draftRef = useRef(draft);
  const { query, platform, result, showResults, detail, performanceId, tickets } = draft;
  function change(patch: Partial<FinderDraft>) {
    const next = { ...draftRef.current, ...patch }; draftRef.current = next; setDraft(next); onDraftChange?.(next);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  useEffect(() => { if (saved && draftRef.current.showResults) change({ showResults: false }); }, [saved]);

  async function search(page = 1, searchQuery = query, fresh = false) {
    if (/^https?:\/\//i.test(searchQuery.trim())) { await load(searchQuery.trim(), platformForCatalogUrl(searchQuery.trim())?.id ?? platform); return; }
    const request = ++version.current; setBusy(true); setError('');
    try {
      const data = await catalogClient.search(searchQuery, page, platform, fresh);
      if (request === version.current) change({ result: data, showResults: true });
    } catch (e) { if (request === version.current) setError(e instanceof Error ? e.message : 'Không tìm được sự kiện.'); }
    finally { if (request === version.current) setBusy(false); }
  }
  async function choosePerformance(value: ConcertDetail, id: string, request: number, fresh = false) {
    change({ performanceId: id, tickets: null });
    const integration = platformForUrl(value.url)?.integration;
    if (integration) onReset(id ? integration.withPerformance(new URL(value.url), id).href : undefined);
    const performance = value.performances.find(p => p.id === id); if (!performance) return;
    const catalog = await catalogClient.tickets(value.id, id, value.platform, fresh);
    if (request !== version.current) return;
    change({ tickets: catalog }); onLoad({ detail: value, performance, catalog });
  }
  async function load(url: string, source: Platform = platform, fresh = false, keepPerformance?: string) {
    const request = ++version.current; setBusy(true); setError('');
    change({ ...(source !== platform ? { platform: source, result: null } : {}), showResults: false, detail: null, tickets: null, performanceId: '' });
    onReset();
    try {
      const value = await catalogClient.detail(url, source, fresh);
      if (request !== version.current) return;
      change({ detail: value });
      const explicit = platformForUrl(url)?.integration?.performanceId(new URL(url)) ??
        (source === 'ticketbox' ? new URL(url).pathname.match(/^\/events\/\d+\/bookings\/([1-9]\d{0,15})\//)?.[1] : undefined) ?? keepPerformance;
      if (explicit && !value.performances.some(p => p.id === explicit)) throw new Error('Suất trong link không thuộc sự kiện này. Chọn lại đúng ngày và địa điểm.');
      const selected = explicit || (value.performances.length === 1 ? value.performances[0]!.id : '');
      if (selected) await choosePerformance(value, selected, request, fresh);
    } catch (e) { if (request === version.current) setError(e instanceof Error ? e.message : 'Không tải được chi tiết.'); }
    finally { if (request === version.current) setBusy(false); }
  }
  useEffect(() => {
    if (requestedUrl) void load(requestedUrl.url, platformForCatalogUrl(requestedUrl.url)?.id ?? platform);
  }, [requestedUrl]);
  function changeEvent() {
    version.current++; change({ detail: null, tickets: null, performanceId: '', showResults: true }); setBusy(false); setError(''); onReset();
  }
  const showSaved = saved && !detail && !showResults;
  return <section className="event-finder" aria-labelledby="finder-title">
    <div className="section-title"><h2 id="finder-title">{(detail && !showResults) || showSaved ? 'Sự kiện' : 'Tìm sự kiện'}</h2>{((detail && !showResults) || showSaved) && <button type="button" className="subtle-button" onClick={changeEvent}>Đổi sự kiện</button>}</div>
    {showSaved && <div className="event-detail selected-event"><h3><strong>{saved.title}</strong></h3><span>{saved.venue}</span><small>{eventDate(saved.startsAt)} · giờ diễn</small></div>}
    {(!detail || showResults) && !showSaved && <>
    {platform === 'ticketbox' && !detail ? <button className="target-shortcut" type="button" aria-label={`Chuẩn bị ${ATVNCG_PRESET.title}`} disabled={busy} onClick={() => { change({ query: ATVNCG_PRESET.query }); void search(1, ATVNCG_PRESET.query, true); }}><strong>{ATVNCG_PRESET.title}</strong><small>05–06/12 · Hưng Yên · Ticketbox</small><span>Tìm sự kiện mới nhất →</span></button> : shortcut && !detail && <button className="target-shortcut" type="button" aria-label={`Chuẩn bị ${shortcut.title}`} onClick={shortcut.onChoose}><strong>{shortcut.title}</strong><small>{shortcut.description}</small><span>Chuẩn bị sự kiện →</span></button>}
    <label className="sr-only" htmlFor="source">Nguồn sự kiện</label>
    <select id="source" value={platform} onChange={e => { version.current++; change({ platform: e.target.value as Platform, result: null, detail: null, tickets: null, performanceId: '' }); setError(''); setBusy(false); onReset(); }}>
      {PLATFORM_CATALOG.map(p => <option key={p.id} value={p.id} disabled={!p.catalogOrigin}>{p.name} · {p.integration ? 'tìm và camp' : p.catalogOrigin ? 'tra cứu vé' : 'chưa kết nối'}</option>)}
    </select>
    {(!detail || showResults) && <div className="search-row"><input aria-label="Tìm concert" value={query} maxLength={500} placeholder="Tên sự kiện hoặc link bán vé" onChange={e => { version.current++; setBusy(false); setError(''); change({ result: null, query: e.target.value }); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} />
      <button type="button" disabled={busy} onClick={() => void search()}>Tìm</button></div>}
    {result && <div className="result-meta">{result.items.length} kết quả{query && ` cho “${query}”`}</div>}
    {result && showResults && <><div className="event-results">
      {result.items.map(event => <button type="button" className="event-result" key={event.id} disabled={busy} onClick={() => void load(event.url, event.platform)}>
        <strong>{event.title}</strong><span>{eventDate(event.startsAt)}{event.venue && ` · ${event.venue}`}</span><small>{event.status === 'COMING_SOON' ? 'Sắp mở bán · Chưa công bố suất và hạng vé' : event.priceFromVnd !== undefined ? `Từ ${money(event.priceFromVnd)}` : 'Xem hạng vé'}{event.status === 'CLOSE' ? ' · Chưa mở/đã đóng bán' : ''}</small>
      </button>)}
      {!result.items.length && <p className="empty-note">Không có kết quả. Thử tên khác hoặc dán link sự kiện.</p>}
    </div>{result.totalPages > 1 && <div className="pagination"><button type="button" disabled={busy || result.page <= 1} onClick={() => void search(result.page - 1)}>Trước</button><span>Trang {result.page} / {result.totalPages}</span><button type="button" disabled={busy || result.page >= result.totalPages} onClick={() => void search(result.page + 1)}>Sau</button></div>}</>}
    </>}
    {busy && <p className="muted" role="status">Đang tải dữ liệu sự kiện…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {detail && !showResults && <div className="event-detail selected-event"><h3><strong>{detail.title}</strong></h3><span>{detail.venue}</span>
      <label>Suất diễn<select aria-label="Suất diễn" value={performanceId} disabled={busy} onChange={e => {
        const request = ++version.current; setBusy(true); setError('');
        void choosePerformance(detail, e.target.value, request).catch(e => { if (request === version.current) setError(e instanceof Error ? e.message : 'Không tải được hạng vé.'); }).finally(() => { if (request === version.current) setBusy(false); });
      }}><option value="">Chọn đúng ngày và địa điểm</option>{detail.performances.map(p => <option key={p.id} value={p.id}>{eventDate(p.startsAt)} · {p.venue}</option>)}</select></label>
      {!detail.performances.length && <p className="empty-note">Nguồn chưa công bố suất diễn để chọn.</p>}
      <button type="button" className="subtle-button" disabled={busy} onClick={() => void load(detail.url, detail.platform, true, performanceId || undefined)}>Cập nhật suất và hạng vé</button>
      {detail.platform === 'onezone' && tickets?.layout === 'SEAT_MAP' && <p className="source-note">Tool nhận diện cách chọn khu/ghế trên trang đặt vé.</p>}
      {!platformForUrl(detail.url)?.integration && <><p className="source-note">{detail.status === 'COMING_SOON' ? 'Sắp mở bán. Ticketbox mới công bố banner, chưa có dữ liệu để camp.' : `Đã đọc thông tin ${PLATFORM_CATALOG.find(p => p.id === detail.platform)?.name}. Luồng camp chưa được xác minh.`}</p><a className="external-link" href={detail.url} target="_blank" rel="noreferrer">Mở sự kiện trên website ↗</a>
        {tickets && <><p className="source-note">{tickets.layout === 'SEAT_MAP' ? 'Có sơ đồ chọn chỗ' : tickets.layout === 'TICKET_TYPES' ? 'Chọn hạng và số vé' : 'Chưa xác định cách chọn chỗ'}{tickets.requiresQueue ? ' · Có phòng chờ' : ''}{detail.requiresAttendeeForm ? ' · Có biểu mẫu người tham dự' : ''}</p><ul className="ticket-preview">{tickets.tickets.map(t => <li key={t.id}><span>{t.name}{t.available === 0 ? ' · Đang đóng/hết vé' : ''}{t.minQuantity && t.minQuantity > 1 ? ` · Tối thiểu ${t.minQuantity} vé` : ''}</span><b>{money(t.priceVnd)}</b></li>)}</ul></>}</>}
    </div>}
  </section>;
}
