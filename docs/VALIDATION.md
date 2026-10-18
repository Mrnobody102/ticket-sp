# Kiểm thử · 0.5.5 · 18/10/2026

Windows, Node.js 22.11.0, npm 10.9.0; WXT 0.21.4, Vite 6.4.4, Vitest 4.1.12; Chromium 156 qua Playwright. Các bài mua vé dùng dữ liệu tổng hợp và profile tạm, không dùng tài khoản hoặc tạo đơn thật.

## Bộ kiểm tra

| Lệnh | Kết quả |
|---|---|
| `npm run check` | PASS: TypeScript strict/noUnused, 210 unit tests / 18 files, build production |
| `npm run test:e2e` | 39 ca đạt trong lượt toàn bộ; ca thứ 40 (nhãn ảnh) đạt sau khi sửa UTF-8 của fixture và chạy riêng. Tổng 13 catalog, 20 extension/diễn tập, 7 runtime; output cuối chạy lại 7 ca UI/ảnh/báo cáo/CAPTCHA/diễn tập đều đạt |
| UI/báo cáo 0.5.5 | E2E tải JSON từ content script sau checkout: đúng phiên bản/hạng/số vé/thời gian, không phát sinh click đặt vé; unit không xuất preferencesKey, tab ID hoặc query token; thiếu số lượng quan sát thì để trống |
| Phân loại checkout và nhãn nút | PASS nhãn Việt/Anh, hoa/thường, khoảng trắng và ARIA; nhãn chưa hỗ trợ không được đoán; FAQ nhắc thanh toán kèm form nhận email không tạo CHECKOUT giả. Hai E2E mở sẵn trang cũng có FAQ/form này |
| Mở trang trước khi bật từ popup | PASS cả event còn khóa và booking đã hiện vé: khớp calendarId dù có tab cùng event/suất khác, session giữ đúng tab ID, không tạo tab trùng, tới checkout 1 vé; mỗi bước chỉ click một lần và không bấm thanh toán cuối |
| `npm run release` | PASS: ZIP bạn bè 217.007 byte, ZIP Store 212.539 byte; manifest/tài nguyên/cú pháp JS qua validator; 15 file production trong mỗi gói khớp SHA-256 output |
| `node scripts/prepare-store.mjs --extension=artifacts/share-install-0.5.5-a4ba1806/tien-ich` | PASS từ chính ZIP cuối: diễn tập 2 vé tới checkout, 0 pageerror, 0 HTTP request; 2 ảnh 1280×800 |
| Đính chính ngày bán | Unit giữ giờ tùy chỉnh/suất khác; E2E nâng phiên bản bằng profile lưu thật xác nhận 19/10 → 18/10 12:00, giữ ÚT CƯNG và 2 vé, không tự tạo phiên camp |
| Runtime lỗi cũ | PASS lúc khởi tạo và bấm camp: lỗi được bắt, không Uncaught/click vé. Worker mới + content cũ không có handshake thì không tạo phiên camp |
| `npm run bench:camp` | PASS 24 mẫu trên 0.5.5, 2 tình huống; 0 pageerror, đúng một click mỗi bước, không bấm thanh toán cuối |
| Mâu thuẫn sau khi chọn | PASS E2E modal sai class ID và hai khu cùng selected: tạm dừng trước ADVANCE, 0 click Tiếp tục; unit giữ đúng trường hợp ghế A1 có class/zone hợp lệ |
| `npm run smoke:catalog` ở 0.5.2 | Tham chiếu API thật 1Zone Hà Nội 4 hạng, HAI QUÝ 2 khu, ÚT CƯNG 6 khu và max=2; Ticketbox 11 hạng; không lưu cấu hình/bật camp. Parser catalog không thay trong 0.5.3–0.5.5 |
| `node scripts/smoke-live.mjs <link-Hà-Nội>` | PASS trên đúng trang công khai `8h0YGm`: chưa mở bán, đúng 1 bảng camp, 0 pageerror; không bật camp hoặc bấm mua |
| `node scripts/audit-open-shows.mjs` | 3 show OPEN: Lavender 7 hạng, Trúc Nhân 4, Lời Chưa Kịp Nói 6; production parser/reader nhận 1 CTA chính, bấm một lần đều tới đăng nhập, 0 pageerror. Chặn request ghi; không chọn/giữ vé hoặc xác nhận checkout. Chi tiết [khảo sát](KHAO_SAT_1ZONE.md) |

SHA-256 ZIP bạn bè: `a4ba18061069bb3964bb5e20b5b8894033c91c53420126de4be43771b0bac1bb`. Báo cáo từng file ở `.output/release.json`. 0.5.3 thêm kiểm tra khớp tên/ID, modal hợp lệ và chỉ một lựa chọn selected; 0.5.4 siết phân loại checkout; 0.5.5 xuất báo cáo theo yêu cầu, cập nhật observer và bỏ đồng hồ chờ/lời nhắc tab ở checkout, hiển thị hạng đã chọn. Không thêm network request hoặc sleep vào các bước chọn vé.

Lượt E2E 0.5.2 đầu có một bài treo ở harness khi gọi runtime.reload trong worker đang được Playwright debug. Đổi harness thành đóng/mở profile tạm với manifest nâng 0.5.1 → 0.5.2, xác nhận onInstalled sửa cấu hình đã lưu. Chạy lại cả 7 bài runtime đạt; không thay migration production để làm bài qua.

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

Các số đo trong mục này được chạy lại trên extension production 0.5.5.

`npm run bench:camp` dùng extension production, summary + zones tổng hợp, khu HAI QUÝ 1 và modal xác nhận cùng khu. Hai phản hồi website mô phỏng: ngay lập tức hoặc 100 ms tại mỗi bước mở vé và checkout. Mỗi tình huống làm nóng một lượt, đo 12 lượt. Đo từ lúc CTA thực sự mở, kiểm tra không bấm sớm, không click lặp, đúng CTA chính và không bấm thanh toán cuối. Báo cáo cục bộ: `artifacts/camp-benchmark.json`.

| Độ trễ website mô phỏng mỗi bước | CTA mở → click mua, p50 / p95 | CTA mở → checkout, p50 / p95 |
|---|---:|---:|
| 0 ms | 9,6 / 15,5 ms | 40,0 / 79,5 ms |
| 100 ms | 18,2 / 41,6 ms | 298,0 / 392,0 ms |

Catalog/preflight và handshake nằm trước lúc chạy; không thêm GET vào từng bước chọn vé. Tốc độ ngoài fixture còn phụ thuộc browser, website, mạng, queue và tồn kho. Không dùng số đo cục bộ để cam kết nhanh nhất hoặc mua được vé.

## Kiểm chứng website thật và giới hạn

Đã đọc lại public HTML, summary API, zones API và thành phần public của đúng suất Hà Nội. Snapshot hiện CLOSE, saleConfig rỗng; API trả 4 hạng/12 khu, seatType auto, ticketType seatmap_zone, yêu cầu CAPTCHA. [Nghiên cứu API](NGHIEN_CUU_API.md) ghi nguồn và phạm vi. GET tickets/seatmap ẩn danh trả mã nghiệp vụ không có dữ liệu dùng được; không triển khai POST giữ vé dựa trên suy đoán.

**Chưa có kiểm thử booking với tài khoản đăng nhập hoặc giao dịch giữ vé thật của suất này.** Chưa xác minh hợp đồng POST tạo giỏ, timeout/idempotence, mọi renderer canvas/iframe hoặc nhóm nhiều ghế. Không đưa các phần đó vào phạm vi đã hỗ trợ. Ticketbox chỉ tra cứu. Backend cấp quyền thương mại chưa triển khai.

Build không sửa được một content script đã nạp trong tab cũ: cần Reload extension rồi tải lại tab. Chrome có thể còn lưu lỗi lịch sử; xóa danh sách lỗi để quan sát lỗi mới. E2E dùng profile tạm đã kiểm tra không có pageerror ở cả lỗi khởi tạo và lỗi khi bấm camp.
