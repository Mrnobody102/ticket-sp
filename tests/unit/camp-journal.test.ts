import { afterEach, expect, it, vi } from 'vitest';
import { appendJournal, diagnosticUrl, journalEntry, JOURNAL_LIMIT, type CampJournal } from '../../src/core/camp-journal';
import { readCampJournal, recordCampJournal, JOURNAL_KEY } from '../../src/infrastructure/camp-journal';
import type { AutoRun } from '../../src/core/automation';

afterEach(() => vi.unstubAllGlobals());
it('chỉ ghi routing đã cho phép, xóa token, queue ID, mã đơn và thông tin đăng nhập', () => {
  expect(diagnosticUrl('https://queue.1zone.vn/?q=secret-queue&t=private&queueittoken=secret')).toBe('https://queue.1zone.vn/');
  expect(diagnosticUrl('https://ticket.1zone.vn/events/demo?calendarId=HN&token=secret')).toBe('https://ticket.1zone.vn/events/demo?calendarId=HN');
  expect(diagnosticUrl('https://ticket.1zone.vn/checkout/private-order?email=secret')).toBe('https://ticket.1zone.vn/');
  expect(diagnosticUrl('https://user:pass@ticketbox.vn/demo-123')).toBeUndefined();
  expect(diagnosticUrl('https://evil.test/')).toBeUndefined();
  expect(diagnosticUrl('https://ticketbox.vn/events/26712/bookings/11992249512361/question-form?token=secret')).toBe('https://ticketbox.vn/events/26712/bookings/11992249512361/question-form');
});
it('không serialize lỗi, HTML, mật khẩu hoặc trường lạ, kể cả payload gửi từ trang', () => {
  const entry = journalEntry({ kind: 'ACTION_ERROR', code: 'ACTION_FAILED', phase: 'CHOOSING', password: 'secret', message: 'email=secret', html: 'secret', at: -1, selectedCount: -1 }, 50);
  expect(entry).toEqual({ at: 50, kind: 'ACTION_ERROR', code: 'ACTION_FAILED', phase: 'CHOOSING' });
  expect(journalEntry({ kind: 'unknown' })).toBeUndefined();
});
it('khử bản ghi trùng và giới hạn lịch sử nhưng vẫn giữ thay đổi trạng thái', () => {
  let log: CampJournal = { runId: 'r', startedAt: 1, entries: [] };
  log = appendJournal(log, { at: 1, kind: 'PAGE', state: 'WAITING_ROOM' });
  expect(appendJournal(log, { at: 2, kind: 'PAGE', state: 'WAITING_ROOM' })).toBe(log);
  for (let i = 0; i < JOURNAL_LIMIT + 10; i++) log = appendJournal(log, { at: i + 3, kind: 'PAGE', state: i % 2 ? 'SELECTING' : 'UNKNOWN' });
  expect(log.entries).toHaveLength(JOURNAL_LIMIT);
  expect(log.entries.at(-1)?.state).toBe('SELECTING');
  log = appendJournal(log, { at: 500, kind: 'ORDER', code: 'ORDER_SENT' });
  log = appendJournal(log, { at: 501, kind: 'ORDER', code: 'ORDER_SENT' });
  expect(log.entries.slice(-2).map(e => e.code)).toEqual(['ORDER_SENT', 'ORDER_SENT']);
});
it('ghi bền qua lần đọc mới và giữ tối đa 3 phiên, không ảnh hưởng luồng mua', async () => {
  const local: Record<string, unknown> = {};
  vi.stubGlobal('chrome', { storage: { local: { get: async (key: string) => ({ [key]: local[key] }), set: async (v: object) => { Object.assign(local, v); } } } });
  const run = { id: '1', startedAt: 1 } as AutoRun;
  for (const id of ['1', '2', '3', '4']) recordCampJournal({ ...run, id }, { at: 1, kind: 'START', phase: 'READY' });
  expect((await readCampJournal())?.runId).toBe('4');
  expect(local[JOURNAL_KEY]).toHaveLength(3);
  expect(await readCampJournal('1')).toBeNull();
  recordCampJournal({ ...run, id: '4' }, { at: 2, kind: 'PAGE', state: 'SELECTING' });
  expect((await readCampJournal('4'))?.entries.map(e => e.kind)).toEqual(['START', 'PAGE']);
});
