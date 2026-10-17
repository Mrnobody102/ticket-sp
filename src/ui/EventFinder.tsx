import { useEffect, useRef, useState } from 'react';
import type { ConcertDetail, ConcertSearchResult, Performance, TicketCatalog } from '../core/catalog';
import type { Platform } from '../core/models';
import { catalogClient } from '../infrastructure/catalog-client';
import { money } from '../core/preferences';
import { PLATFORM_CATALOG, platformForCatalogUrl, platformForUrl } from '../core/platform-catalog';

export interface LoadedConcert { detail: ConcertDetail; performance: Performance; catalog: TicketCatalog }
export const eventDate = (value?: string) => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : 'Chưa có lịch';

export function EventFinder({ onLoad, onReset, manualUrl, requestedUrl, shortcut }: {
  onLoad(value: LoadedConcert): void; onReset(): void; manualUrl: string;
  requestedUrl?: { url: string; requestId: number };
  shortcut?: { label: string; description: string; onChoose(): void };
}) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<Platform>('onezone');
  const [result, setResult] = useState<ConcertSearchResult | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [detail, setDetail] = useState<ConcertDetail | null>(null);
  const [performanceId, setPerformanceId] = useState('');
  const [tickets, setTickets] = useState<TicketCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);

  async function search(page = 1) {
    const request = ++version.current; setBusy(true); setError('');
    try {
      const data = await catalogClient.search(query, page, platform);
      if (request === version.current) { setResult(data); setShowResults(true); }
    } catch (e) { if (request === version.current) setError(e instanceof Error ? e.message : 'Không tìm được sự kiện.'); }
    finally { if (request === version.current) setBusy(false); }
  }
  async function choosePerformance(value: ConcertDetail, id: string, request: number) {
    setPerformanceId(id); setTickets(null); if (platformForUrl(value.url)?.integration) onReset();
    const performance = value.performances.find(p => p.id === id); if (!performance) return;
    const catalog = await catalogClient.tickets(value.id, id, value.platform);
    if (request !== version.current) return;
    setTickets(catalog); onLoad({ detail: value, performance, catalog });
  }
  async function load(url: string, source: Platform = platform) {
    if (source !== platform) { setPlatform(source); setResult(null); }
    const request = ++version.current; setBusy(true); setError(''); setShowResults(false); setDetail(null); setTickets(null); setPerformanceId(''); if (PLATFORM_CATALOG.find(p => p.id === source)?.integration) onReset();
    try {
      const value = await catalogClient.detail(url, source);
      if (request !== version.current) return;
      setDetail(value);
      const explicit = platformForUrl(url)?.integration?.performanceId(new URL(url));
      if (explicit && !value.performances.some(p => p.id === explicit)) throw new Error('Suất trong link không thuộc sự kiện này. Chọn lại đúng ngày và địa điểm.');
      const selected = explicit || (value.performances.length === 1 ? value.performances[0]!.id : '');
      if (selected) await choosePerformance(value, selected, request);
    } catch (e) { if (request === version.current) setError(e instanceof Error ? e.message : 'Không tải được chi tiết.'); }
    finally { if (request === version.current) setBusy(false); }
  }
  useEffect(() => {
    if (requestedUrl) void load(requestedUrl.url, platformForCatalogUrl(requestedUrl.url)?.id ?? platform);
  }, [requestedUrl]);
  return <section className="event-finder" aria-labelledby="finder-title">
    <div className="section-title"><h2 id="finder-title">Tìm sự kiện</h2><span>Dữ liệu từ nền tảng bán vé</span></div>
    {shortcut && !detail && <button className="target-shortcut" type="button" onClick={shortcut.onChoose}><strong>{shortcut.label}</strong><small>{shortcut.description}</small></button>}
    <label className="sr-only" htmlFor="source">Nguồn sự kiện</label>
    <select id="source" value={platform} onChange={e => { version.current++; setPlatform(e.target.value as Platform); setResult(null); setDetail(null); setTickets(null); setPerformanceId(''); setError(''); setBusy(false); }}>
      {PLATFORM_CATALOG.map(p => <option key={p.id} value={p.id} disabled={!p.catalogOrigin}>{p.name} · {p.integration ? 'tìm và camp' : p.catalogOrigin ? 'tra cứu vé' : 'chưa kết nối'}</option>)}
    </select>
    {(!detail || showResults) && <div className="search-row"><input aria-label="Tìm concert" value={query} maxLength={120} placeholder="Tên concert, nghệ sĩ, địa điểm" onChange={e => { version.current++; setBusy(false); setResult(null); setError(''); setQuery(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} />
      <button type="button" disabled={busy} onClick={() => void search()}>Tìm</button></div>}
    {detail && !showResults && !result && <button type="button" className="subtle-button" onClick={() => setShowResults(true)}>Tìm sự kiện khác</button>}
    {!result && !busy && !detail && <p className="empty-note">Tìm theo tên hoặc tải chi tiết từ link đã nhập.</p>}
    {result && <div className="result-meta">{result.items.length} kết quả{query && ` cho “${query}”`}{!showResults && <button type="button" className="subtle-button" onClick={() => setShowResults(true)}>Xem lại kết quả</button>}</div>}
    {result && showResults && <><div className="event-results">
      {result.items.map(event => <button type="button" className="event-result" key={event.id} disabled={busy} onClick={() => void load(event.url, event.platform)}>
        <strong>{event.title}</strong><span>{eventDate(event.startsAt)}{event.venue && ` · ${event.venue}`}</span><small>{event.priceFromVnd !== undefined ? `Từ ${money(event.priceFromVnd)}` : 'Xem hạng vé'}{event.status === 'CLOSE' ? ' · Chưa mở/đã đóng bán' : ''}</small>
      </button>)}
      {!result.items.length && <p className="empty-note">Không có kết quả. Thử tên khác hoặc dán link sự kiện.</p>}
    </div>{result.totalPages > 1 && <div className="pagination"><button type="button" disabled={busy || result.page <= 1} onClick={() => void search(result.page - 1)}>Trước</button><span>Trang {result.page} / {result.totalPages}</span><button type="button" disabled={busy || result.page >= result.totalPages} onClick={() => void search(result.page + 1)}>Sau</button></div>}</>}
    <button type="button" className="subtle-button" disabled={busy || !manualUrl.trim()} onClick={() => void load(manualUrl, platformForCatalogUrl(manualUrl)?.id ?? platform)}>Tải chi tiết từ link</button>
    {busy && <p className="muted" role="status">Đang tải dữ liệu sự kiện…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {detail && !showResults && <div className="event-detail"><h3>{detail.title}</h3><p>{detail.venue}</p>
      <label>Suất diễn<select aria-label="Suất diễn" value={performanceId} disabled={busy} onChange={e => {
        const request = ++version.current; setBusy(true); setError('');
        void choosePerformance(detail, e.target.value, request).catch(e => { if (request === version.current) setError(e instanceof Error ? e.message : 'Không tải được hạng vé.'); }).finally(() => { if (request === version.current) setBusy(false); });
      }}><option value="">Chọn đúng ngày và địa điểm</option>{detail.performances.map(p => <option key={p.id} value={p.id}>{eventDate(p.startsAt)} · {p.venue}</option>)}</select></label>
      <small>Đây là giờ diễn ra, không phải giờ mở bán.</small>
      {!detail.performances.length && <p className="empty-note">Nguồn chưa công bố suất diễn để chọn.</p>}
      {!platformForUrl(detail.url)?.integration && <><p className="source-note">Đã đọc được hạng và giá vé {PLATFORM_CATALOG.find(p => p.id === detail.platform)?.name}. Luồng camp chưa được xác minh.</p><a className="external-link" href={detail.url} target="_blank" rel="noreferrer">Mở sự kiện trên website ↗</a>
        {tickets && <ul className="ticket-preview">{tickets.tickets.map(t => <li key={t.id}><span>{t.name}</span><b>{money(t.priceVnd)}</b></li>)}</ul>}</>}
      {platformForUrl(detail.url)?.integration && tickets && <small>Đã tải {tickets.tickets.length} hạng vé · {new Date(tickets.fetchedAt).toLocaleTimeString('vi-VN')}</small>}
    </div>}
  </section>;
}
