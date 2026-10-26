import { useEffect, useState } from 'react';
import type { PageSnapshot, TaskConfig, WorkflowState } from '../core/models';
import { countdown, isSameTaskPage, money } from '../core/preferences';
import type { Recommendation } from '../core/workflow';
import { autoActive, hasUnresolvedReservation, type AutoPhase, type AutoRun } from '../core/automation';
import { EXTENSION_VERSION } from '../infrastructure/extension-runtime';

const stateLabels: Record<WorkflowState, string> = {
  NOT_READY: 'Chưa mở bán', WAITING_ROOM: 'Đang xếp hàng', EVENT_PAGE: 'Trang sự kiện',
  SELECTING: 'Đang chọn vé', CHECKOUT: 'Thanh toán', CHALLENGE: 'Cần xác minh', UNKNOWN: 'Chưa nhận diện', STOPPED: 'Đã dừng',
};
const modeLabels = { ZONE_ONLY: 'Chọn khu vực', PICK_SEAT: 'Chọn ghế', ASSIGNED_SEAT: 'Ghế tự cấp', MIXED: 'Nhiều cách chọn theo khu vực', UNKNOWN: 'Chưa rõ cách chọn chỗ' };
const phaseLabels: Record<AutoPhase, string> = {
  READY: 'Đang camp', OPENING: 'Vào trang đặt vé', CHOOSING: 'Chọn vé', QUANTITY: 'Kiểm tra số lượng',
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
  onSaveReport?: () => void;
  autoRun?: AutoRun | null;
  onStartAuto?: () => void;
  onStopAuto?: () => void;
  rehearsal?: boolean;
  background?: boolean;
  autoBusy?: boolean;
  observationOnly?: boolean;
}

export function Panel({ config, snapshot, recommendations: options, error, onRescan, onStop, onHide, onOpen, onSaveReport, autoRun, onStartAuto, onStopAuto, rehearsal, background, autoBusy, observationOnly }: Props) {
  const [now, setNow] = useState(Date.now());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const p = observationOnly ? null : config.preferences;
  const sameEvent = p && isSameTaskPage(snapshot.url, p);
  const running = autoActive(autoRun ?? null);
  const atCheckout = autoRun?.progress.phase === 'CHECKOUT';
  const uncertain = !running && hasUnresolvedReservation(autoRun);
  const waitingForStock = running && autoRun?.progress.phase === 'READY' && snapshot.state === 'SELECTING' && !options.length;
  const routineScreen = sameEvent && snapshot.supported && ['NOT_READY', 'SELECTING', 'EVENT_PAGE'].includes(snapshot.state);
  return <aside className={`assistant ${collapsed ? 'collapsed' : ''}`} aria-label="Trợ lý camp vé">
    <header className="panel-header">
      <button className="brand-button" onClick={() => setCollapsed(v => !v)} title="Thu gọn hoặc mở rộng">
        <span>Camp vé <small className="panel-version">v{EXTENSION_VERSION}</small></span>
      </button>
      {!rehearsal && <button className="icon-button" onClick={onHide} aria-label="Ẩn panel" title="Hiện lại từ icon tiện ích">×</button>}
    </header>
    {!collapsed && <>
      <div className="status-line"><span className={`status-dot ${config.enabled ? 'active' : ''}`} />{!p && snapshot.state === 'NOT_READY' ? 'Chưa cấu hình' : stateLabels[snapshot.state]}</div>
      {observationOnly && <p className="reason">Ticketbox · Chỉ đọc, chưa tự mua</p>}
      {p && p.startMode !== 'IMMEDIATE' && !rehearsal && !atCheckout && <div className="countdown-card">
        <span className="eyebrow">GIỜ MỞ BÁN ĐÃ ĐẶT · VIỆT NAM</span>
        <strong className="countdown" role="timer">{countdown(p.saleStartAt, now)}</strong>
        <small>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(p.saleStartAt))}</small>
      </div>}
      <div className="panel-body">
        {(onStartAuto || autoRun) && <div className="auto-status" role="status" data-auto-phase={autoRun?.progress.phase} data-auto-pending={autoBusy ? 'true' : 'false'}>
          <b>{running && snapshot.state === 'CHALLENGE' ? 'Chờ xác minh' : waitingForStock ? 'Chờ vé ưu tiên' : autoRun ? phaseLabels[autoRun.progress.phase] : 'Camp tới thanh toán'}</b>
          {running && snapshot.state === 'CHALLENGE' ? <p>Chờ website xác minh; tool tự tiếp tục.</p> : waitingForStock ? <p>{snapshot.reason}</p> : autoRun && !['READY', 'CHECKOUT'].includes(autoRun.progress.phase) && <p>{autoRun.progress.message}</p>}
          {autoRun?.progress.checkoutReachedAt && autoRun.progress.selectionStartedAt && <p>Chọn vé → thanh toán: {((autoRun.progress.checkoutReachedAt - autoRun.progress.selectionStartedAt) / 1000).toFixed(2)} giây (phiên này).</p>}
          {onStartAuto && autoRun?.progress.phase !== 'CHECKOUT' && <button className={running ? 'danger-button' : 'primary'} disabled={!p || (autoBusy && !running)} onClick={running ? onStopAuto : uncertain ? onRescan : onStartAuto}>{running ? 'Dừng camp' : uncertain ? 'Nhận diện lại' : 'Bắt đầu camp'}</button>}
        </div>}
        {!rehearsal && !observationOnly && <p className={`event-match ${sameEvent ? 'ok' : ''}`}>{sameEvent ? 'Đúng link / suất đã lưu' : 'Chưa khớp sự kiện đã lưu'}</p>}
        {!rehearsal && !(running && (routineScreen || snapshot.state === 'CHALLENGE')) &&
          !(autoRun?.progress.phase === 'PAUSED' && autoRun.progress.message === snapshot.reason) && <p className="reason">{snapshot.reason}</p>}
        {p && <>
          <div className="metrics"><span><b>{p.quantity}</b> vé</span><span>{p.maxTotalVnd ? money(p.maxTotalVnd) : 'Theo giá hạng vé'}</span></div>
          {snapshot.selectionMode !== 'UNKNOWN' && <p className="muted">{modeLabels[snapshot.selectionMode]}</p>}
          {p.quantity > 1 && snapshot.visibleOptions.some(o => o.kind === 'SEAT') && <p className="muted">Bạn muốn nhiều vé; chưa hỗ trợ ghép ghế.</p>}
          <p className="muted">{atCheckout && autoRun?.progress.chosen ? `Đã chọn: ${autoRun.progress.chosen.label}${autoRun.progress.chosen.zoneLabel ? ` · ${autoRun.progress.chosen.zoneLabel}` : ''}` : `Ưu tiên: ${p.preferredZoneLabels.join(' → ') || 'Tất cả hạng vé'}`}</p>
          {snapshot.maxQuantity !== undefined && <p className={p.quantity > snapshot.maxQuantity ? 'error' : 'muted'}>Website ghi tối đa {snapshot.maxQuantity} vé/giao dịch.{p.quantity > snapshot.maxQuantity ? ' Giảm số vé trong cấu hình.' : ''}</p>}
        </>}
        {options.length > 0 ? <div className="recommendations">
          <span className="eyebrow">LỰA CHỌN PHÙ HỢP ĐANG HIỂN THỊ</span>
          {options.slice(0, 4).map(({ option, estimatedTotalVnd }, i) => <div className="recommendation" key={option.id}>
            <span className="rank">{i + 1}</span><div><b>{option.label}</b>{option.kind === 'SEAT' ? <small>Ghế cụ thể{option.zoneLabel ? ` · ${option.zoneLabel}` : ''}</small> : option.zoneLabel && <small>{option.zoneLabel}</small>}<small>{estimatedTotalVnd === undefined ? 'Website chưa hiển thị giá rõ ràng' : `${money(estimatedTotalVnd)} / ${p?.quantity} vé · chưa tính phí`}</small></div>
          </div>)}
        </div> : snapshot.state === 'SELECTING' && !waitingForStock && <p className="muted">{snapshot.visibleOptions.length > 0 && snapshot.visibleOptions.every(o => o.displayedAvailability === 'UNAVAILABLE') ? 'Các khu ưu tiên hiện không còn vé khả dụng.' : 'Chưa có lựa chọn khớp đủ điều kiện. Kiểm tra hạng vé, giá và số lượng trực tiếp.'}</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {!rehearsal && <details className="panel-tools"><summary>Thao tác khác</summary><div className="panel-actions"><button onClick={onRescan}>Nhận diện lại</button>{!observationOnly && <button onClick={onOpen}>Mở trang vé</button>}{onSaveReport && <button onClick={onSaveReport}>Lưu báo cáo</button>}{!observationOnly && !autoActive(autoRun ?? null) && <button className="danger-button" disabled={!config.enabled} onClick={onStop}>Tắt công cụ</button>}</div></details>}
        {!rehearsal && !atCheckout && <p className="footnote">{background && autoActive(autoRun ?? null) ? 'Đưa tab vé ra phía trước để tránh chậm giờ.' : 'Giữ tab vé ở phía trước và máy thức.'}</p>}
      </div>
    </>}
  </aside>;
}
