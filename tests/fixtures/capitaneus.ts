// Reduced public metadata observed on 26/10/2026. Booking UI below is synthetic.
export const capitaneusUrl = 'https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6';
export const capitaneusEvent = {
  id: 'kAapup', pathName: 'capitaneus-mutabilis-2026', name: 'CAPITANEUS MUTABILIS',
  address: 'Sân khấu C30, TP. HCM', currencyCode: 'VND', status: 'CLOSE', canPurchase: true, collaboration: 'seatmap',
  eventCalendar: [{ eventId: 'kAapup', calendarId: 'XDacU6', location: 'Sân khấu C30 Hoà Bình, TP. HCM', startDate: '2026-11-22T12:00:00.700Z', endDate: '2026-11-22T14:00:00.700Z', maxTicketPerUser: -1 }],
};
export const capitaneusTypes = [
  { ticketClassId: '6ad88e0b752d7e5347844265', referenceId: '6ad88e372c6887e6983dd952', name: 'SUMMER', finalPriceVn: 1690000 },
  { ticketClassId: '6ad88e23752d7e5347844270', referenceId: '6ad88e3a2c6887e6983dd956', name: 'SPRING', finalPriceVn: 990000 },
  { ticketClassId: '6ad88dbd752d7e534784423c', referenceId: '6ad88e342c6887e6983dd94e', name: 'AUTUMN', finalPriceVn: 2690000 },
  { ticketClassId: '6ad88da0752d7e534784422e', referenceId: '6ad88e302c6887e6983dd94a', name: 'WINTER', finalPriceVn: 3690000 },
].map(t => ({ ...t, eventId: 'kAapup', calendarId: 'XDacU6', type: 'zone', ticketType: 'seatmap', zoneName: t.name, seatType: 'auto', maxTicketPerUser: 2, isShowInBooking: true, isCaptchaEnable: true, availableTickets: 1 }));
export const capitaneusZones = capitaneusTypes.map(t => ({ id: t.referenceId, name: t.name, ticketClassId: t.ticketClassId, eventId: t.eventId, calendarId: t.calendarId }));
