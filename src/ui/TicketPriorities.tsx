import type { TicketType } from '../core/catalog';
import { money } from '../core/preferences';

export function TicketPriorities({ tickets, selected, onChange }: { tickets: TicketType[]; selected: string[]; onChange(ids: string[]): void }) {
  function move(index: number, offset: number) { const next = [...selected]; [next[index], next[index + offset]] = [next[index + offset]!, next[index]!]; onChange(next); }
  return <section className="ticket-priorities" aria-label="Hạng vé ưu tiên">
    <label>Hạng vé ưu tiên<select aria-label="Thêm hạng vé ưu tiên" value="" disabled={selected.length >= 20} onChange={e => { if (e.target.value) onChange([...selected, e.target.value]); }}><option value="">Chọn hạng và giá vé</option>{tickets.filter(t => !selected.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name} · {money(t.priceVnd)}{t.available === 0 ? ' · hiện hết vé' : ''}</option>)}</select></label>
    <ol>{selected.map((id, index) => { const ticket = tickets.find(t => t.id === id); return ticket && <li key={id}><div><b>{ticket.name}</b><small>{money(ticket.priceVnd)} / vé{ticket.zoneName && ` · ${ticket.zoneName}`}</small></div><div className="priority-actions">
      <button type="button" aria-label={`Tăng ưu tiên ${ticket.name}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Giảm ưu tiên ${ticket.name}`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Bỏ ${ticket.name}`} onClick={() => onChange(selected.filter(value => value !== id))}>×</button>
    </div></li>; })}</ol>
    {selected.length > 1 && <small>Thử theo thứ tự từ trên xuống.</small>}
  </section>;
}
