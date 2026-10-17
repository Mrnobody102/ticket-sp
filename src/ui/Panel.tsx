import { useEffect, useState } from 'react';
import type { PageSnapshot, TaskConfig, WorkflowState } from '../core/models';
import { countdown, isSameEvent, money } from '../core/preferences';
import type { Recommendation } from '../core/workflow';
import { autoActive, type AutoPhase, type AutoRun } from '../core/automation';
import { EXTENSION_VERSION } from '../infrastructure/extension-runtime';

const stateLabels: Record<WorkflowState, string> = {
  NOT_READY: 'Chưa sẵn sàng', WAITING_ROOM: 'Đang xếp hàng', EVENT_PAGE: 'Trang concert',
  SELECTING: 'Đang chọn vé', CHECKOUT: 'Thanh toán', CHALLENGE: 'Cần xác minh', UNKNOWN: 'Chưa nhận diện', STOPPED: 'Đã dừng',
};
const modeLabels = { ZONE_ONLY: 'Chọn khu vực', PICK_SEAT: 'Chọn ghế', ASSIGNED_SEAT: 'Ghế tự cấp', MIXED: 'Nhiều cách chọn theo khu vực', UNKNOWN: 'Chưa rõ cách chọn chỗ' };
const phaseLabels: Record<AutoPhase, string> = {
  READY: 'Sẵn sàng', OPENING: 'Vào trang đặt vé', CHOOSING: 'Chọn vé', QUANTITY: 'Kiểm tra số lượng',
  SETTING_QUANTITY: 'Đặt số lượng', ADVANCING: 'Chuyển tới thanh toán', CHECKOUT: 'Đã tới thanh toán', PAUSED: 'Tạm dừng',
};

interface Props {
  config: TaskConfig;
  snapshot: PageSnapshot;
  recommendations: Recommendation[];
  error?: string;
  onRescan: () => void;
  onStop: () => void;
  onHide: () => void;
  onOpen: () => void;
  autoRun?: AutoRun | null;
  onStartAuto?: () => void;
  onStopAuto?: () => void;
  rehearsal?: boolean;
}

export function Panel({ config, snapshot, recommendations: options, error, onRescan, onStop, onHide, onOpen, autoRun, onStartAuto, onStopAuto, rehearsal }: Props) {
  const [now, setNow] = useState(Date.now());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const p = config.preferences;
  const sameEvent = p && isSameEvent(snapshot.url, p.eventUrl);
  return <aside className={`assistant ${collapsed ? 'collapsed' : ''}`} aria-label="Trợ lý camp vé">
    <header className="panel-header">
      <button className="brand-button" onClick={() => setCollapsed(v => !v)} title="Thu gọn hoặc mở rộng">
        <span>Camp vé <small className="panel-version">v{EXTENSION_VERSION}</small></span>
      </button>
      {!rehearsal && <button className="icon-button" onClick={onHide} aria-label="Ẩn panel" title="Hiện lại từ icon tiện ích">×</button>}
    </header>
    {!collapsed && <>
      <div className="status-line"><span className={`status-dot ${config.enabled ? 'active' : ''}`} />{stateLabels[snapshot.state]}</div>
      {p && !rehearsal && <div className="countdown-card">
        <span className="eyebrow">GIỜ MỞ BÁN ĐÃ ĐẶT · VIỆT NAM</span>
        <strong className="countdown" role="timer">{countdown(p.saleStartAt, now)}</strong>
        <small>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(p.saleStartAt))}</small>
      </div>}
      <div className="panel-body">
        {(onStartAuto || autoRun) && <div className="auto-status" role="status" data-auto-phase={autoRun?.progress.phase}>
          <b>{autoRun ? phaseLabels[autoRun.progress.phase] : 'Camp tới thanh toán'}</b>
          {autoRun && <p>{autoRun.progress.message}</p>}
          {autoRun?.progress.checkoutReachedAt && autoRun.progress.selectionStartedAt && <p>Chọn vé → thanh toán: {((autoRun.progress.checkoutReachedAt - autoRun.progress.selectionStartedAt) / 1000).toFixed(2)} giây (phiên này).</p>}
          {onStartAuto && <button className={autoActive(autoRun ?? null) ? 'danger-button' : 'primary'} disabled={!p} onClick={autoActive(autoRun ?? null) ? onStopAuto : onStartAuto}>{autoActive(autoRun ?? null) ? 'Dừng camp' : 'Bắt đầu camp'}</button>}
        </div>}
        {!rehearsal && <p className={`event-match ${sameEvent ? 'ok' : ''}`}>{sameEvent ? 'Đúng link / suất đã lưu' : 'Chưa khớp sự kiện đã lưu'}</p>}
        {!rehearsal && <p className="reason">{snapshot.reason}</p>}
        {p && <>
          <div className="metrics"><span><b>{p.quantity}</b> vé</span><span>{p.maxTotalVnd ? money(p.maxTotalVnd) : 'Không giới hạn ngân sách'}</span></div>
          {snapshot.selectionMode !== 'UNKNOWN' && <p className="muted">{modeLabels[snapshot.selectionMode]}</p>}
          {p.quantity > 1 && snapshot.visibleOptions.some(o => o.kind === 'SEAT') && <p className="muted">Bạn muốn nhiều vé; chưa hỗ trợ ghép ghế.</p>}
          <p className="muted">Ưu tiên: {p.preferredZoneLabels.join(' → ') || 'Tất cả hạng vé'}</p>
          {snapshot.maxQuantity !== undefined && <p className={p.quantity > snapshot.maxQuantity ? 'error' : 'muted'}>Website ghi tối đa {snapshot.maxQuantity} vé/giao dịch.{p.quantity > snapshot.maxQuantity ? ' Giảm số vé trong cấu hình.' : ''}</p>}
        </>}
        {options.length > 0 ? <div className="recommendations">
          <span className="eyebrow">LỰA CHỌN PHÙ HỢP ĐANG HIỂN THỊ</span>
          {options.slice(0, 4).map(({ option, estimatedTotalVnd }, i) => <div className="recommendation" key={option.id}>
            <span className="rank">{i + 1}</span><div><b>{option.label}</b>{option.kind === 'SEAT' && <small>Ghế cụ thể{option.zoneLabel ? ` · ${option.zoneLabel}` : ''}</small>}<small>{estimatedTotalVnd === undefined ? 'Website chưa hiển thị giá rõ ràng' : `${money(estimatedTotalVnd)} / ${p?.quantity} vé · chưa tính phí`}</small></div>
          </div>)}
        </div> : snapshot.state === 'SELECTING' && <p className="muted">Chưa có lựa chọn khớp đủ điều kiện. Kiểm tra hạng vé, giá và số lượng trực tiếp.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {!rehearsal && <div className="panel-actions"><button onClick={onRescan}>Nhận diện lại</button><button onClick={onOpen}>Mở concert</button><button className="danger-button" disabled={!config.enabled} onClick={onStop}>Dừng</button></div>}
        {!rehearsal && <p className="footnote">Giữ Chrome mở và máy thức.</p>}
      </div>
    </>}
  </aside>;
}
