# Kiểm thử · 0.5.1 · 18/10/2026

Windows, Node.js 22.11.0, npm 10.9.0; WXT 0.21.4, Vite 6.4.4, Vitest 4.1.12; Chromium 156 qua Playwright. Các bài mua vé dùng dữ liệu tổng hợp và profile tạm, không dùng tài khoản hoặc tạo đơn thật.

## Bộ kiểm tra

| Lệnh | Kết quả |
|---|---|
| `npm run check` | PASS: TypeScript strict/noUnused, 182 unit tests / 16 files, build production |
| `npm run test:e2e` | PASS 34 ca: 9 catalog, 19 extension/diễn tập, 6 runtime |
| `npm run release` | PASS: ZIP bạn bè 213.962 byte, ZIP Store 209.636 byte; manifest/tài nguyên/cú pháp JS qua validator; 15 file production trong mỗi gói khớp SHA-256 output |
| `node scripts/prepare-store.mjs --extension=artifacts/share-install-0.5.1-1102f351/tien-ich` | PASS từ ZIP cuối giải nén vào thư mục mới, diễn tập 2 vé tới checkout; 0 pageerror, 0 HTTP request; 2 ảnh 1280×800 |
| Runtime lỗi cũ | PASS lúc khởi tạo và bấm camp: lỗi được bắt, không Uncaught/click vé. Worker mới + content cũ không có handshake thì không tạo phiên camp |
| `npm run bench:camp` | PASS 24 mẫu, 2 tình huống; 0 pageerror, đúng một click mỗi bước |
| `npm run smoke:catalog` | PASS: API thật 1Zone Hà Nội 4 hạng, HAI QUÝ 2 khu, ÚT CƯNG 6 khu và max=2; Ticketbox 11 hạng; không lưu cấu hình, không bật camp, không pageerror |
| `node scripts/smoke-live.mjs <link-Hà-Nội>` | PASS trên đúng trang công khai `8h0YGm`: chưa mở bán, đúng 1 bảng camp, 0 pageerror; không bật camp hoặc bấm mua |

SHA-256 ZIP bạn bè: `1102f3517959ee265849ca1c8df5cb5e6c1b091a92d2652692b8f6ee1811968d`. Báo cáo từng file ở `.output/release.json`. Sau lượt đủ 34 E2E, thay đổi cuối chỉ giảm chiều cao iframe diễn tập để vừa màn 1280×800; build/release và các E2E diễn tập được kiểm tra lại trên output cuối.

Lượt E2E đầu của đợt sửa này có 2 lỗi: locator còn dùng tên nút cũ và heading xác minh mô phỏng không khớp dấu hiệu adapter. Đã sửa cả hai rồi chạy lại đủ 34 ca đạt; không bỏ hoặc nới điều kiện của bài kiểm tra.

Workflow GitHub đã chuẩn bị để chạy cùng các bước kiểm tra và tạo artifact. Chưa kích hoạt workflow trên GitHub hoặc đăng Web Store; kiểm tra cục bộ không phải kết quả CI Linux.

## Ma trận hành vi

| Tình huống | Kỳ vọng đã kiểm tra |
|---|---|
| Catalog 1Zone/Ticketbox | Đúng schema riêng; event/performance/ticket ID, currency, giá, ngày, venue và giới hạn; từ chối sai/thiếu dữ liệu |
| Trước lúc bật camp | Đọc mới detail + tickets; giá, cách chọn chỗ, zone hoặc giới hạn đổi thì chặn trước khi mở phiên |
| name khác zoneName | Cùng bản ghi/giá được canonical hóa, giữ ID qua card → modal; alias trùng nhiều ID hoặc ID trên nút sai bị loại |
| Một hạng có nhiều khu | Ghép summary + zones theo class ID; từ chối sai event/suất, ID/tên trùng hoặc thiếu map. Khu cụ thể phải khớp trong modal; không lấy alias cũ ngoài tập khu đã xác minh |
| Ảnh, SVG, ARIA | Đọc alt/aria-label/aria-labelledby/title kèm giá; một ghế SVG đi tới checkout trong Chromium |
| Ảnh/pixel thiếu nhãn hoặc giá | Không suy ra tọa độ, tên/giá; không tạo lựa chọn có thể bấm |
| Ẩn, disabled, hết vé, trùng ID/nhãn | Không chọn nhầm điều khiển; không gộp nhóm ghế thành một zone |
| Quantity input/select/stepper/modal span | Đặt đúng số lượng và chờ website xác nhận; giá gạch ngang không thay giá hiện tại |
| Đổi suất | Bỏ giờ bán/số lượng/budget/fallback của suất cũ trước khi GET mới; giờ diễn không được dùng làm giờ bán |
| DOM/SPA đổi trong lúc await | Đọc lại và quyết định trước click; STOP, đổi config, stale revision hoặc tab khác không thực thi hành động cũ |
| Phòng chờ | Giữ tab; qua queue lâu hơn timeout điều hướng, trở về event rồi vào booking; không reset bước giữ vé chưa xác nhận |
| CAPTCHA/đăng nhập/hết hạn giữ chỗ | Tạm dừng; không vượt xác minh hoặc gửi lại lệnh giữ vé chưa rõ kết quả |
| Chưa mở bán | Chờ giờ/nút khả dụng; reload một lần nếu đã bật tùy chọn, không refresh queue/CAPTCHA/checkout |
| Checkout | Dừng tự động hóa; nút thanh toán cuối chưa được bấm |
| Browser restart, đóng tab, ẩn panel | Cấu hình bền, phiên không tự khởi động sau browser restart; tab chủ đóng thì hủy; ẩn UI vẫn chạy |
| Popup đóng / worker bị ngắt / không dừng | Cùng run ID sau CDP stopWorker và đóng popup, đến giờ chỉ đặt một lần; tự hết hạn khi còn queue |
| START/STOP đến muộn | Không START lặp, không rewind revision mới, STOP ngắt local ngay và phản hồi/broadcast cũ không bật lại |
| Runtime/worker cũ hoặc mất kết nối | Khóa bắt đầu khi setup lỗi, hiện hướng dẫn; SAVE từ content vẫn bị chặn |
| Diễn tập | Luồng mặc định 1–2 vé, queue đợi admission, xác minh tạm dừng rồi khởi động lại; Làm lại xóa bài trước; không ghi config/session thật hoặc gọi mạng |
| UI | Select thật từ catalog, lỗi GET có thể thử lại; popup 460×600 không tràn ngang, Lưu/Bắt đầu trong viewport |

## Tốc độ

`npm run bench:camp` dùng extension production, summary + zones tổng hợp, khu HAI QUÝ 1 và modal xác nhận cùng khu. Hai phản hồi website mô phỏng: ngay lập tức hoặc 100 ms tại mỗi bước mở vé và checkout. Mỗi tình huống làm nóng một lượt, đo 12 lượt. Đo từ lúc CTA thực sự mở, kiểm tra không bấm sớm, không click lặp, đúng CTA chính và không bấm thanh toán cuối. Báo cáo cục bộ: `artifacts/camp-benchmark.json`.

| Độ trễ website mô phỏng mỗi bước | CTA mở → click mua, p50 / p95 | CTA mở → checkout, p50 / p95 |
|---|---:|---:|
| 0 ms | 29,9 / 46,0 ms | 124,0 / 244,0 ms |
| 100 ms | 18,6 / 79,1 ms | 322,9 / 377,1 ms |

Catalog/preflight và handshake nằm trước lúc chạy; không thêm GET vào từng bước chọn vé. Tốc độ ngoài fixture còn phụ thuộc browser, website, mạng, queue và tồn kho. Không dùng số đo cục bộ để cam kết nhanh nhất hoặc mua được vé.

## Kiểm chứng website thật và giới hạn

Đã đọc lại public HTML, summary API, zones API và thành phần public của đúng suất Hà Nội. Snapshot hiện CLOSE, saleConfig rỗng; API trả 4 hạng/12 khu, seatType auto, ticketType seatmap_zone, yêu cầu CAPTCHA. [Nghiên cứu API](NGHIEN_CUU_API.md) ghi nguồn và phạm vi. GET tickets/seatmap ẩn danh trả mã nghiệp vụ không có dữ liệu dùng được; không triển khai POST giữ vé dựa trên suy đoán.

**Chưa có kiểm thử booking với tài khoản đăng nhập hoặc giao dịch giữ vé thật của suất này.** Chưa xác minh hợp đồng POST tạo giỏ, timeout/idempotence, mọi renderer canvas/iframe hoặc nhóm nhiều ghế. Không đưa các phần đó vào phạm vi đã hỗ trợ. Ticketbox chỉ tra cứu. Backend cấp quyền thương mại chưa triển khai.

Build không sửa được một content script đã nạp trong tab cũ: cần Reload extension rồi tải lại tab. Chrome có thể còn lưu lỗi lịch sử; xóa danh sách lỗi để quan sát lỗi mới. E2E dùng profile tạm đã kiểm tra không có pageerror ở cả lỗi khởi tạo và lỗi khi bấm camp.
