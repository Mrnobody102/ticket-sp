// Minimal synthetic records following the public schemas observed on 1Zone/Ticketbox.
// These are not responses copied from a customer session.
export const catalogUrl = 'https://ticket.1zone.vn/events/catalog-test';
export const calendar = (calendarId = 'HN') => ({ calendarId, eventId: 'event-test', startDate: '2030-11-21T04:00:00.000Z', endDate: '2030-11-21T15:00:00.000Z', location: calendarId === 'HN' ? 'Cung Thiếu nhi Hà Nội' : 'TP.HCM', maxTicketPerUser: 2 });
export const eventData = { id: 'event-test', pathName: 'catalog-test', name: 'Fan meeting thử nghiệm', address: 'Hà Nội', currencyCode: 'VND', status: 'CLOSE', eventCalendar: [calendar()] };
export const flightHtml = (event: unknown = eventData) => `<html><script>self.__next_f.push(${JSON.stringify([1, `0:{"eventData":${JSON.stringify(event)}}`])})</script></html>`;
export const ticketData = { ticketClassId: 'vip-test', eventId: 'event-test', calendarId: 'HN', name: 'VIP', finalPriceVn: 1200000, maxTicketPerUser: 2, availableTickets: 2, seatType: 'auto', isShowInBooking: true, isCaptchaEnable: true };
export const ticketReply = (tickets: unknown[] = [ticketData]) => ({ errorCode: 0, data: tickets });
export const searchItem = { id: 'event-test', name: eventData.name, path: '/catalog-test', location: 'Hà Nội', day: calendar().startDate, status: 'CLOSE', price: 1200000 };
export const ticketboxUrl = 'https://ticketbox.vn/catalog-test-26657';
export const ticketboxData = { id: 26657, title: 'Ticketbox thử nghiệm', venue: 'Hà Nội', address: 'Cung Thiếu nhi', startTime: calendar().startDate, endTime: calendar().endDate,
  showings: [{ id: 53858377012103, startTime: calendar().startDate, endTime: calendar().endDate, ticketTypes: [{ id: 100001, name: 'VIP', price: 2000000, maxQtyPerOrder: 2, status: 'available' }] }] };
export const ticketboxReply = (result: unknown = ticketboxData) => ({ status: 1, data: { result } });
