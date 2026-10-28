/** User-confirmed target and sale time. This is a suggestion, never an armed task. */
export const HANOI_PRESET = {
  title: 'TIỆC THÀNH-THÂN (MÂM 2): VƯƠNG BÌNH 💘 VOI CON',
  eventUrl: 'https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm',
  saleStartAt: '2026-10-18T05:00:00.000Z',
  quantity: 1,
  preferredTicketName: 'HAI QUÝ - EB',
} as const;

export const CAPITANEUS_PRESET = {
  title: 'CAPITANEUS MUTABILIS',
  eventUrl: 'https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6',
  quantity: 1,
  saleStartAt: '2026-10-26T05:00:00.000Z',
} as const;

/** Schedule supplied by the user on 28/10; not yet confirmed by Ticketbox API. */
export const ATVNCG_PRESET = {
  title: 'ATVNCG 2026 · DAY 3 & DAY 4',
  query: 'ANH TRAI VƯỢT NGÀN CHÔNG GAI 2026 DAY 3 DAY 4',
  saleStartAt: '2026-11-04T05:00:00.000Z',
  saleWindows: [
    { label: 'Gai Con Membership', at: '2026-11-04T02:00:00.000Z' },
    { label: 'Chủ thẻ Techcombank Visa', at: '2026-11-04T03:00:00.000Z' },
    { label: 'Mở bán chính thức', at: '2026-11-04T05:00:00.000Z' },
  ],
} as const;
