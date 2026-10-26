import { beforeEach, expect, it, vi } from 'vitest';
import { createOnezoneCatalog, parseOnezoneDetail } from '../../src/platforms/onezone-catalog';
import { inspectPlatform } from '../../src/platforms/registry';
import { decideAutomation, preferencesKey, type AutoRun } from '../../src/core/automation';
import type { EventPreferences } from '../../src/core/models';
import { capitaneusEvent, capitaneusTypes, capitaneusUrl, capitaneusZones } from '../fixtures/capitaneus';
import { flightHtml } from '../fixtures/catalog';

const provider = () => createOnezoneCatalog(async url => ({ errorCode: 0, data: url.includes('/zones?') ? capitaneusZones : capitaneusTypes }));
async function preferences(): Promise<EventPreferences> {
  const catalog = await provider().tickets('kAapup', 'XDacU6');
  return { platform: 'onezone', eventUrl: capitaneusUrl, saleStartAt: new Date(0).toISOString(), quantity: 2, preferredZoneLabels: ['SUMMER'], allowAlternatives: false,
    catalog: { ...catalog, title: capitaneusEvent.name, venue: capitaneusEvent.address, startsAt: capitaneusEvent.eventCalendar[0]!.startDate, verifiedAt: 1, tickets: [catalog.tickets[0]!] } };
}
beforeEach(() => vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList));

it('CAPITANEUS: đúng suất, giới hạn 2 vé và cảnh báo layout ghế dù seatType auto', async () => {
  const detail = parseOnezoneDetail(flightHtml(capitaneusEvent), capitaneusUrl);
  expect(detail.performances[0]).toMatchObject({ id: 'XDacU6', saleStatus: 'CLOSED', maxQuantity: undefined });
  const catalog = await provider().tickets(detail.id, 'XDacU6');
  expect(catalog.layout).toBe('SEAT_MAP');
  expect(catalog.tickets.map(t => [t.name, t.priceVnd, t.maxQuantity, t.seatMode])).toEqual([
    ['SUMMER', 1690000, 2, 'AUTO'], ['SPRING', 990000, 2, 'AUTO'], ['AUTUMN', 2690000, 2, 'AUTO'], ['WINTER', 3690000, 2, 'AUTO'],
  ]);
  expect(catalog.tickets.every(t => t.requiresChallenge && t.zones?.length === 1)).toBe(true);
});

it('iframe Seats.io cạnh container có tên giống Konva: dừng rõ ràng, không chờ renderer mãi hoặc bấm giữ vé', async () => {
  const p = await preferences();
  document.body.innerHTML = '<h1>Chọn ghế</h1><div id="seatmap-container-kAapup-demo"><div id="seatio"><iframe title="Seating chart" src="https://chart-oc.seatsio.net/"></iframe></div></div><button>Tiếp tục</button>';
  const view = inspectPlatform(document, new URL(capitaneusUrl.replace('/events/', '/booking/')), { preferences: p, progress: { phase: 'READY', message: '' } });
  expect(view.snapshot).toMatchObject({ state: 'UNKNOWN', supported: false, unsupportedVariant: true, visibleOptions: [] });
  expect(view.snapshot.reason).toContain('Seats.io');
  expect(view.automation!.page.selectionPending).toBe(false);
  const run: AutoRun = { id: 'cap', tabId: 1, revision: 0, startedAt: 0, expiresAt: 100000, preferencesKey: preferencesKey(p), progress: { phase: 'READY', message: '' } };
  expect(decideAutomation(run, view.automation!.page, p, 1)).toMatchObject({ type: 'STEP', progress: { phase: 'PAUSED' } });
  expect(decideAutomation(run, view.automation!.page, p, 1)).not.toHaveProperty('action');
});

it('chưa mở bán được ưu tiên hơn sơ đồ iframe, không nhầm thành bước chọn ghế', async () => {
  const p = await preferences();
  document.body.innerHTML = '<h3>Sắp mở bán</h3><button disabled data-id="btn-by-ticket">Sắp mở bán</button><div id="seatio"><iframe title="Seating chart"></iframe></div>';
  expect(inspectPlatform(document, new URL(capitaneusUrl), { preferences: p, progress: { phase: 'READY', message: '' } }).snapshot.state).toBe('NOT_READY');
});
