import { useEffect, useState } from 'react';
import type { PageSnapshot, TaskConfig, WorkflowState } from '../core/models';
import { countdown, isSameEvent, money } from '../core/preferences';
import type { Recommendation } from '../core/workflow';
import { autoActive, type AutoRun } from '../core/automation';

const stateLabels: Record<WorkflowState, string> = {
  NOT_READY: 'Chưa sẵn sàng', WAITING_ROOM: 'Đang xếp hàng', EVENT_PAGE: 'Trang concert',
  SELECTING: 'Đang chọn vé', CHECKOUT: 'Thanh toán', CHALLENGE: 'Cần xác minh', UNKNOWN: 'Chưa nhận diện', STOPPED: 'Đã dừng',
};
const modeLabels = { ZONE_ONLY: 'Chọn khu vực', PICK_SEAT: 'Chọn ghế', ASSIGNED_SEAT: 'Ghế tự cấp', MIXED: 'Nhiều cách chọn theo khu vực', UNKNOWN: 'Chưa rõ cách chọn chỗ' };
const modeGuidance = {
  ZONE_ONLY: 'Chọn khu vực và số lượng trên website. Chưa xác định cách bố trí chỗ nếu mô tả không nói rõ.',
  ASSIGNED_SEAT: 'Chọn hạng/khu vực và số lượng; website cấp ghế theo quy định sự kiện. Chưa khẳng định ghế ngẫu nhiên hay liền nhau.',
  PICK_SEAT: 'Cần chọn ghế cụ thể trên website. Tool chỉ gợi ý ghế có nhãn đọc được; chưa hỗ trợ chọn nhóm ghế liền nhau.',
  MIXED: 'Kiểm tra quy định từng khu: khu vực khác nhau có thể chọn ghế hoặc được cấp chỗ tự động.',
  UNKNOWN: 'Chưa đủ dữ liệu để xác định cách chọn chỗ. Kiểm tra hướng dẫn của sự kiện.',
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
}

export function Panel({ config, snapshot, recommendations: options, error, onRescan, onStop, onHide, onOpen, autoRun, onStartAuto, onStopAuto }: Props) {
  const [now, setNow] = useState(Date.now());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const p = config.preferences;
  const sameEvent = p && isSameEvent(snapshot.url, p.eventUrl);
  return <aside className={`assistant ${collapsed ? 'collapsed' : ''}`} aria-label="Trợ lý camp vé">
    <header className="panel-header">
      <button className="brand-button" onClick={() => setCollapsed(v => !v)} title="Thu gọn hoặc mở rộng">
        <span className="brand-mark">C</span><span>Camp vé <small>1ZONE ASSISTANT</small></span>
      </button>
      <button className="icon-button" onClick={onHide} aria-label="Ẩn panel" title="Hiện lại từ icon tiện ích">×</button>
    </header>
    {!collapsed && <>
      <div className="status-line"><span className={`status-dot ${config.enabled ? 'active' : ''}`} />{stateLabels[snapshot.state]}<span className="mode-tag">ASSIST</span></div>
      {p && <div className="countdown-card">
        <span className="eyebrow">GIỜ MỞ BÁN ĐÃ ĐẶT · VIỆT NAM</span>
        <strong className="countdown" role="timer">{countdown(p.saleStartAt, now)}</strong>
        <small>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(p.saleStartAt))}</small>
      </div>}
      <div className="panel-body">
        {onStartAuto && <div className="auto-status" role="status">
          <b>{autoRun ? `Camp · ${autoRun.progress.phase}` : 'Camp tới thanh toán'}</b>
          <p>{autoRun?.progress.message ?? 'Tự chọn vé theo ưu tiên, đặt số lượng và bấm tiếp tới checkout.'}</p>
          {autoRun?.progress.checkoutReachedAt && autoRun.progress.selectionStartedAt && <p>Chọn vé → checkout: {((autoRun.progress.checkoutReachedAt - autoRun.progress.selectionStartedAt) / 1000).toFixed(2)} giây (phiên này).</p>}
          <button className={autoActive(autoRun ?? null) ? 'danger-button' : 'primary'} disabled={!p} onClick={autoActive(autoRun ?? null) ? onStopAuto : onStartAuto}>{autoActive(autoRun ?? null) ? 'Dừng camp' : 'Bắt đầu camp'}</button>
        </div>}
        <p className={`event-match ${sameEvent ? 'ok' : ''}`}>{sameEvent ? '✓ Đúng link concert / suất diễn đã lưu' : '○ Chưa khớp concert đã lưu'}</p>
        <p className="reason">{snapshot.reason}</p>
        {p && <>
          <div className="metrics"><span><b>{p.quantity}</b> vé muốn mua</span><span>{p.maxTotalVnd ? money(p.maxTotalVnd) : 'Không giới hạn ngân sách'}</span></div>
          <p className="muted">{modeLabels[snapshot.selectionMode]}</p>
          {snapshot.state === 'SELECTING' && <p className="muted">{modeGuidance[snapshot.selectionMode]}</p>}
          {p.quantity > 1 && snapshot.visibleOptions.some(o => o.kind === 'SEAT') && <p className="muted">Bạn muốn nhiều vé; tool chưa gợi ý nhóm ghế hoặc xác minh ghế liền nhau.</p>}
          <p className="muted">Ưu tiên: {p.preferredZoneLabels.join(' → ') || 'Tất cả hạng vé'}</p>
          {snapshot.maxQuantity !== undefined && <p className={p.quantity > snapshot.maxQuantity ? 'error' : 'muted'}>Website ghi tối đa {snapshot.maxQuantity} vé/giao dịch.{p.quantity > snapshot.maxQuantity ? ' Giảm số vé trong cấu hình.' : ''}</p>}
        </>}
        {options.length > 0 ? <div className="recommendations">
          <span className="eyebrow">LỰA CHỌN PHÙ HỢP ĐANG HIỂN THỊ</span>
          {options.slice(0, 4).map(({ option, estimatedTotalVnd }, i) => <div className="recommendation" key={option.id}>
            <span className="rank">{i + 1}</span><div><b>{option.label}</b>{option.kind === 'SEAT' && <small>Ghế cụ thể{option.zoneLabel ? ` · ${option.zoneLabel}` : ''}</small>}<small>{estimatedTotalVnd === undefined ? 'Website chưa hiển thị giá rõ ràng' : `${money(estimatedTotalVnd)} / ${p?.quantity} vé · chưa tính phí`}</small></div>
          </div>)}
          <p className="muted">{autoActive(autoRun ?? null) ? 'Camp đang tự chọn theo cấu hình đã lưu. Tool chờ website xác nhận sau mỗi thao tác.' : 'Khung xanh đánh dấu lựa chọn phù hợp. Bắt đầu camp để tự chọn và đi tới checkout.'}</p>
        </div> : snapshot.state === 'SELECTING' && <p className="muted">Chưa có lựa chọn khớp đủ điều kiện. Kiểm tra hạng vé, giá và số lượng trực tiếp.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="panel-actions"><button onClick={onRescan}>Nhận diện lại</button><button onClick={onOpen}>Mở concert</button><button className="danger-button" disabled={!config.enabled} onClick={onStop}>Dừng</button></div>
        <p className="footnote">Nhắc theo đồng hồ máy. Giờ đã đặt không xác nhận website đã mở bán. Giữ Chrome mở và máy thức.</p>
      </div>
    </>}
  </aside>;
}
