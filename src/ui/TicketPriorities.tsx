import { useState } from 'react';
import type { TicketType } from '../core/catalog';
import { money } from '../core/preferences';

export function TicketPriorities({ tickets, selected, onChange }: { tickets: TicketType[]; selected: string[]; onChange(ids: string[]): void }) {
  const [candidate, setCandidate] = useState('');
  function move(index: number, offset: number) { const next = [...selected]; [next[index], next[index + offset]] = [next[index + offset]!, next[index]!]; onChange(next); }
  return <section className="ticket-priorities" aria-label="Hạng vé ưu tiên">
    <label>Thêm hạng vé ưu tiên<select value={candidate} onChange={e => setCandidate(e.target.value)}><option value="">Chọn hạng và giá vé</option>{tickets.filter(t => !selected.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name} · {money(t.priceVnd)}{t.available === 0 ? ' · hiện hết vé' : ''}</option>)}</select></label>
    <button type="button" disabled={!candidate || selected.length >= 20 || selected.includes(candidate) || !tickets.some(t => t.id === candidate)} onClick={() => { onChange([...selected, candidate]); setCandidate(''); }}>Thêm ưu tiên</button>
    <ol>{selected.map((id, index) => { const ticket = tickets.find(t => t.id === id); return ticket && <li key={id}><div><b>{ticket.name}</b><small>{money(ticket.priceVnd)} / vé{ticket.zoneName && ` · ${ticket.zoneName}`}</small></div><div className="priority-actions">
      <button type="button" aria-label={`Tăng ưu tiên ${ticket.name}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Giảm ưu tiên ${ticket.name}`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Bỏ ${ticket.name}`} onClick={() => onChange(selected.filter(value => value !== id))}>×</button>
    </div></li>; })}</ol>
    {!selected.length && <p className="muted">Thêm ít nhất một hạng. Tool thử theo thứ tự từ trên xuống.</p>}
    <p className="muted">Giá và tình trạng là dữ liệu tại lúc tải; website sẽ xác nhận lại khi đặt.</p>
  </section>;
}
