# Kiểm thử · 0.5.0 · 18/10/2026

Windows, Node.js 22.11.0, npm 10.9.0; WXT 0.21.4, Vite 6.4.4, Vitest 4.1.12; Chromium 156 qua Playwright. Các bài mua vé dùng dữ liệu tổng hợp và profile tạm, không dùng tài khoản hoặc tạo đơn thật.

## Bộ kiểm tra

| Lệnh | Kết quả |
|---|---|
| `npm run check` | PASS: TypeScript strict/noUnused, 157 unit tests / 14 files, build production |
| `npm run test:e2e` | PASS 27 ca: 8 catalog, 14 extension/diễn tập, 5 runtime |
| `npm install` | Audit 246 packages, 0 vulnerabilities; khai báo trực tiếp zero-zip 1.0.1 đã được WXT sử dụng |
| `npm run release` | PASS: ZIP bạn bè 209.985 byte, ZIP Store 205.916 byte; 15 file production trong mỗi gói khớp SHA-256 output |
| `node scripts/prepare-store.mjs --extension=artifacts/share-install-0.5.0-60b4e1b3/tien-ich` | PASS từ ZIP cuối giải nén vào thư mục mới, diễn tập 2 vé tới checkout; 0 pageerror, 0 HTTP request; 2 ảnh 1280×800 |
| Runtime lỗi cũ | PASS cả lúc khởi tạo và lúc bấm camp: thông báo khắc phục trên panel, không Uncaught, không click vé |
| `npm run bench:camp` | PASS 24 mẫu, 2 tình huống; 0 pageerror, đúng một click mỗi bước |
| `npm run smoke:catalog` | PASS: API thật 1Zone Hà Nội 4 hạng, select HAI QUÝ/HAI QUÝ 2 và max=2; Ticketbox 11 hạng; không lưu cấu hình, không bật camp, không pageerror |

SHA-256 ZIP bạn bè: `60b4e1b3143de50a22b5f44e3288452b24137e8616a1f44d21794e46543c1700`. Báo cáo từng file ở `.output/release.json`. Typecheck và ba E2E diễn tập được chạy lại sau khi cấu hình diễn tập đi qua cùng validator production.

Workflow GitHub đã chuẩn bị để chạy cùng các bước kiểm tra và tạo artifact. Chưa kích hoạt workflow trên GitHub hoặc đăng Web Store; kiểm tra cục bộ không phải kết quả CI Linux.

## Ma trận hành vi

| Tình huống | Kỳ vọng đã kiểm tra |
|---|---|
| Catalog 1Zone/Ticketbox | Đúng schema riêng; event/performance/ticket ID, currency, giá, ngày, venue và giới hạn; từ chối sai/thiếu dữ liệu |
| Trước lúc bật camp | Đọc mới detail + tickets; giá, cách chọn chỗ, zone hoặc giới hạn đổi thì chặn trước khi mở phiên |
| name khác zoneName | Cùng bản ghi/giá được canonical hóa, giữ ID qua card → modal; alias trùng nhiều ID hoặc ID trên nút sai bị loại |
| Ảnh, SVG, ARIA | Đọc alt/aria-label/aria-labelledby/title kèm giá; một ghế SVG đi tới checkout trong Chromium |
| Ảnh/pixel thiếu nhãn hoặc giá | Không suy ra tọa độ, tên/giá; không tạo lựa chọn có thể bấm |
| Ẩn, disabled, hết vé, trùng ID/nhãn | Không chọn nhầm điều khiển; không gộp nhóm ghế thành một zone |
| Quantity input/select/stepper/modal span | Đặt đúng số lượng và chờ website xác nhận; giá gạch ngang không thay giá hiện tại |
| Đổi suất | Bỏ giờ bán/số lượng/budget/fallback của suất cũ trước khi GET mới; giờ diễn không được dùng làm giờ bán |
| DOM/SPA đổi trong lúc await | Đọc lại và quyết định trước click; STOP, đổi config, stale revision hoặc tab khác không thực thi hành động cũ |
| Phòng chờ | Giữ tab, tiếp tục khi website chuyển tới đúng trang chọn vé |
| CAPTCHA/đăng nhập/hết hạn giữ chỗ | Tạm dừng; không vượt xác minh hoặc gửi lại lệnh giữ vé chưa rõ kết quả |
| Chưa mở bán | Chờ giờ/nút khả dụng; reload một lần nếu đã bật tùy chọn, không refresh queue/CAPTCHA/checkout |
| Checkout | Dừng tự động hóa; nút thanh toán cuối chưa được bấm |
| Browser restart, đóng tab, ẩn panel | Cấu hình bền, phiên không tự khởi động sau browser restart; tab chủ đóng thì hủy; ẩn UI vẫn chạy |
| Runtime/worker cũ hoặc mất kết nối | Khóa bắt đầu khi setup lỗi, hiện hướng dẫn; SAVE từ content vẫn bị chặn |
| Diễn tập | Luồng mặc định 1–2 vé tới checkout, Làm lại xóa bài trước; không ghi config/session thật hoặc gọi mạng |
| UI | Select thật từ catalog, lỗi GET có thể thử lại; popup 460×600 không tràn ngang, Lưu/Bắt đầu trong viewport |

## Tốc độ

`npm run bench:camp` dùng extension production với hai phản hồi website mô phỏng: ngay lập tức hoặc 100 ms tại mỗi bước mở vé và checkout. Mỗi tình huống làm nóng một lượt, đo 12 lượt. Đo từ lúc CTA thực sự mở, kiểm tra không bấm sớm, không click lặp, đúng CTA chính và không bấm thanh toán cuối. Báo cáo cục bộ: `artifacts/camp-benchmark.json`.

| Độ trễ website mô phỏng mỗi bước | CTA mở → click mua, p50 / p95 | CTA mở → checkout, p50 / p95 |
|---|---:|---:|
| 0 ms | 8,2 / 21,7 ms | 34,8 / 52,8 ms |
| 100 ms | 9,5 / 63,6 ms | 269,3 / 332,9 ms |

Catalog/preflight và handshake nằm trước lúc chạy; không thêm GET vào từng bước chọn vé. Tốc độ ngoài fixture còn phụ thuộc browser, website, mạng, queue và tồn kho. Không dùng số đo cục bộ để cam kết nhanh nhất hoặc mua được vé.

## Kiểm chứng website thật và giới hạn

Đã đọc lại public HTML, summary API và thành phần public của đúng suất Hà Nội. Snapshot hiện CLOSE, saleConfig rỗng; API trả name/zoneName khác nhau và seatType auto, ticketType seatmap_zone, yêu cầu CAPTCHA. [Nghiên cứu API](NGHIEN_CUU_API.md) ghi nguồn và phạm vi.

**Chưa có kiểm thử booking với tài khoản đăng nhập hoặc giao dịch giữ vé thật của suất này.** Chưa xác minh hợp đồng POST tạo giỏ, timeout/idempotence, mọi renderer canvas/iframe hoặc nhóm nhiều ghế. Không đưa các phần đó vào phạm vi đã hỗ trợ. Ticketbox chỉ tra cứu. Backend cấp quyền thương mại chưa triển khai.

Build không sửa được một content script đã nạp trong tab cũ: cần Reload extension rồi tải lại tab. Chrome có thể còn lưu lỗi lịch sử; xóa danh sách lỗi để quan sát lỗi mới. E2E dùng profile tạm đã kiểm tra không có pageerror ở cả lỗi khởi tạo và lỗi khi bấm camp.
