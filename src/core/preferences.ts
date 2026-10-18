import type { EventPreferences, TaskConfig } from './models';
import { DEFAULT_CONFIG } from './models';
import { platformForUrl } from './platform-catalog';
import type { CatalogSelection } from './catalog';

export function eventUrl(value: string): URL {
  const url = new URL(value);
  const integration = platformForUrl(value)?.integration;
  if (!integration || url.username || url.password) {
    throw new Error('Nhập link concert trên nền tảng đã được hỗ trợ.');
  }
  // Route shape, performance identity and tracking parameters belong to each policy.
  const clean = integration.canonicalEventUrl(url);
  if (!clean || clean.origin !== integration.origin) throw new Error('Link concert không hợp lệ.');
  return clean;
}

export function isSameEvent(actual: string, target: string): boolean {
  try {
    const current = new URL(actual);
    const expected = eventUrl(target);
    const integration = platformForUrl(expected.href)!.integration!;
    return current.origin === expected.origin && integration.isSameEvent(current, expected);
  } catch { return false; }
}

export function validatePreferences(value: unknown): EventPreferences {
  if (!value || typeof value !== 'object') throw new Error('Cấu hình không hợp lệ.');
  const p = value as Record<string, unknown>;
  let cleanUrl: URL;
  try { cleanUrl = eventUrl(String(p.eventUrl ?? '')); }
  catch { throw new Error('Nhập link concert trên nền tảng đã được hỗ trợ.'); }
  const platform = platformForUrl(cleanUrl.href)!;
  if (p.platform !== platform.id) throw new Error('Nền tảng không khớp link concert hoặc chưa có adapter.');
  if (typeof p.saleStartAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(p.saleStartAt) ||
      !Number.isFinite(Date.parse(p.saleStartAt))) throw new Error('Giờ mở bán phải có múi giờ rõ ràng.');
  if (typeof p.quantity !== 'number' || !Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 100) {
    throw new Error('Số vé phải là số nguyên từ 1–100; vẫn áp dụng giới hạn của concert.');
  }
  if (p.maxTotalVnd !== undefined && (typeof p.maxTotalVnd !== 'number' ||
      !Number.isSafeInteger(p.maxTotalVnd) || p.maxTotalVnd <= 0)) throw new Error('Tổng ngân sách phải là số đồng dương.');
  if (!Array.isArray(p.preferredZoneLabels) || p.preferredZoneLabels.length > 20 ||
      p.preferredZoneLabels.some(v => typeof v !== 'string' || !v.trim() || v.length > 100)) {
    throw new Error('Nhập tối đa 20 hạng vé, mỗi dòng một hạng (tối đa 100 ký tự).');
  }
  let catalog: CatalogSelection | undefined;
  if (p.catalog !== undefined) {
    const c = p.catalog as CatalogSelection;
    if (!c || typeof c !== 'object' || typeof c.eventId !== 'string' || !/^[\w-]{1,100}$/.test(c.eventId) || typeof c.performanceId !== 'string' || !/^[\w-]{1,100}$/.test(c.performanceId) ||
        platform.integration?.performanceId(cleanUrl) !== c.performanceId || typeof c.title !== 'string' || c.title.length > 300 ||
        typeof c.venue !== 'string' || c.venue.length > 500 || typeof c.startsAt !== 'string' || !Number.isFinite(Date.parse(c.startsAt)) || !Number.isFinite(c.verifiedAt) ||
        (c.maxQuantity !== undefined && (!Number.isSafeInteger(c.maxQuantity) || c.maxQuantity < 0)) ||
        !Array.isArray(c.tickets) || !c.tickets.length || c.tickets.length > 20 || c.tickets.some(t => !t || typeof t.id !== 'string' || !/^[\w-]{1,100}$/.test(t.id) ||
          typeof t.name !== 'string' || !t.name.trim() || t.name.length > 100 || !Number.isSafeInteger(t.priceVnd) || t.priceVnd < 0 ||
          (t.zoneName !== undefined && (typeof t.zoneName !== 'string' || !t.zoneName.trim() || t.zoneName.length > 100)) ||
          (t.zones !== undefined && (!Array.isArray(t.zones) || !t.zones.length || t.zones.length > 500 ||
            t.zones.some(z => !z || typeof z.id !== 'string' || !/^[\w-]{1,100}$/.test(z.id) || typeof z.name !== 'string' || !z.name.trim() || z.name.length > 100) ||
            new Set(t.zones.map(z => z.id)).size !== t.zones.length || new Set(t.zones.map(z => normalize(z.name))).size !== t.zones.length)) ||
          (t.maxQuantity !== undefined && (!Number.isSafeInteger(t.maxQuantity) || t.maxQuantity < 0)) ||
          (t.seatMode !== undefined && !['AUTO', 'PICK', 'UNKNOWN'].includes(t.seatMode))) ||
        new Set(c.tickets.map(t => t.id)).size !== c.tickets.length) throw new Error('Dữ liệu hạng vé/suất không hợp lệ. Tải lại chi tiết sự kiện.');
    catalog = { eventId: c.eventId, performanceId: c.performanceId, title: c.title, venue: c.venue, startsAt: c.startsAt, verifiedAt: c.verifiedAt,
      ...(c.maxQuantity !== undefined ? { maxQuantity: c.maxQuantity } : {}),
      tickets: c.tickets.map(t => ({ id: t.id, name: t.name.trim(), priceVnd: t.priceVnd, ...(t.zoneName ? { zoneName: t.zoneName.trim() } : {}),
        ...(t.zones ? { zones: t.zones.map(z => ({ id: z.id, name: z.name.trim() })) } : {}),
        ...(t.seatMode ? { seatMode: t.seatMode } : {}), ...(t.maxQuantity !== undefined ? { maxQuantity: t.maxQuantity } : {}) })) };
  }
  return {
    platform: platform.id, eventUrl: cleanUrl.href, saleStartAt: new Date(p.saleStartAt).toISOString(),
    quantity: p.quantity, maxTotalVnd: p.maxTotalVnd as number | undefined,
    preferredZoneLabels: catalog ? catalog.tickets.map(t => t.name) : [...new Set((p.preferredZoneLabels as string[]).map(v => v.trim()))],
    allowAlternatives: p.allowAlternatives === true,
    ...(catalog ? { catalog } : {}),
    ...(p.refreshAtSale === true ? { refreshAtSale: true } : {}),
  };
}

export function parseStoredConfig(value: unknown): TaskConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CONFIG };
  const c = value as Partial<TaskConfig>;
  if (c.schemaVersion !== 1) return { ...DEFAULT_CONFIG };
  try {
    const preferences = c.preferences ? validatePreferences(c.preferences) : null;
    return { schemaVersion: 1, preferences, enabled: !!preferences && c.enabled === true, panelVisible: c.panelVisible !== false };
  } catch { return { ...DEFAULT_CONFIG }; }
}

export function fromVietnamLocal(local: string): string {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(local)) throw new Error('Nhập ngày và giờ mở bán (giờ Việt Nam).');
  const iso = local + ':00+07:00';
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp) || toVietnamLocal(new Date(timestamp).toISOString()) !== local) {
    throw new Error('Ngày hoặc giờ không hợp lệ.');
  }
  return new Date(timestamp).toISOString();
}

export function toVietnamLocal(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
export const money = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

export function countdown(iso: string, now: number): string {
  const total = Math.ceil((Date.parse(iso) - now) / 1000);
  if (total <= 0) return 'Đã đến giờ đã đặt';
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${d ? d + ' ngày ' : ''}${[h, m, s].map(n => String(n).padStart(2, '0')).join(':')}`;
}
