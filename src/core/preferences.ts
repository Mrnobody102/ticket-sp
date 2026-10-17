import type { EventPreferences, TaskConfig } from './models';
import { DEFAULT_CONFIG } from './models';

export function eventUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'ticket.1zone.vn' || url.port ||
      url.username || url.password || !/^\/(?:events|booking)\/[^/]+\/?$/.test(url.pathname)) {
    throw new Error('Nhập link https://ticket.1zone.vn/events/… của concert.');
  }
  // Keep calendarId (a specific performance); discard tracking / tokens / fragments.
  const clean = new URL(url.origin + url.pathname.replace(/^\/booking\//, '/events/').replace(/\/$/, ''));
  const calendar = url.searchParams.get('calendarId');
  if (calendar) clean.searchParams.set('calendarId', calendar);
  return clean;
}

export function isSameEvent(actual: string, target: string): boolean {
  try {
    const current = new URL(actual);
    const expected = eventUrl(target);
    const path = expected.pathname;
    const currentPath = current.pathname.replace(/^\/booking\//, '/events/');
    return current.origin === expected.origin &&
      (currentPath.replace(/\/$/, '') === path || currentPath.startsWith(path + '/')) &&
      (!expected.searchParams.has('calendarId') ||
        current.searchParams.get('calendarId') === expected.searchParams.get('calendarId'));
  } catch { return false; }
}

export function validatePreferences(value: unknown): EventPreferences {
  if (!value || typeof value !== 'object') throw new Error('Cấu hình không hợp lệ.');
  const p = value as Record<string, unknown>;
  if (p.platform !== 'onezone') throw new Error('MVP chỉ hỗ trợ 1Zone.');
  let cleanUrl: URL;
  try { cleanUrl = eventUrl(String(p.eventUrl ?? '')); }
  catch { throw new Error('Nhập link https://ticket.1zone.vn/events/… của concert.'); }
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
  return {
    platform: 'onezone', eventUrl: cleanUrl.href, saleStartAt: new Date(p.saleStartAt).toISOString(),
    quantity: p.quantity, maxTotalVnd: p.maxTotalVnd as number | undefined,
    preferredZoneLabels: [...new Set((p.preferredZoneLabels as string[]).map(v => v.trim()))],
    allowAlternatives: p.allowAlternatives === true,
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
