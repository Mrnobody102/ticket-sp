# Kết quả kiểm tra · 0.4.0 · 18/10/2026

Môi trường Windows, Node.js 22.11.0, npm 10.9.0; WXT 0.21.4, Vite 6.4.4, Vitest 4.1.12; Chromium 156 qua Playwright. Browser tests dùng profile tạm và fixtures, không dùng tài khoản hoặc tạo đơn thật.

| Kiểm tra bản 0.4.0 | Kết quả |
|---|---|
| `npm run check` | PASS: TypeScript strict/noUnused + 126 unit tests / 11 files + production build |
| `npm run test:e2e` | PASS: 19 ca, gồm 7 ca catalog và 12 ca extension/hồi quy |
| `npm run bench:camp` | PASS: 24 mẫu đo sau 2 lượt làm nóng, dùng extension production với website/API mô phỏng |
| `node scripts/smoke-target.mjs` | PASS: nhận diện trang Hà Nội công khai, 20 mẫu đọc DOM; không tạo phiên camp hoặc bấm mua |
| `npm run smoke:catalog` | PASS: UI extension production đọc API thật; 1Zone Hà Nội 4 hạng, Ticketbox 11 hạng; không lưu cấu hình, không bật camp, không có page error |
| `npm audit --audit-level=low` | Lượt 0.3.0: 0 vulnerabilities; bản 0.4.0 không đổi dependencies |
| `npm run zip` | PASS: `.output/ticket-sp-0.4.0-chrome.zip`, 199.596 byte; SHA-256 cả 13 file khớp output production |
| Output | Khoảng 629 kB unpacked; 13 file production; manifest MV3/version 0.4.0 |
| Quyền host | 1Zone public/API và Ticketbox API; content entrypoint `tickets` chỉ chạy trên `ticket.1zone.vn` |
| Tài liệu | Đã kiểm tra liên kết file cục bộ; không có lỗi whitespace qua git diff check |

SHA-256 gói 0.4.0: `AC80A67A77EF02EA263EF2B48A61E7F1EA2B4B9ECB861D2EB584B9279071C3EB`. Báo cáo cục bộ ở `artifacts/output-verification.json`.

## Kiểm thử luồng camp

Bảy ca catalog chạy qua message/GET transport thật của background, với response tổng hợp theo schema đã quan sát:

1. Tìm sự kiện, chọn hạng/giá, lưu đúng event/performance/ticket ID; mặc định 1 vé; sửa chưa lưu khóa nút bắt đầu; bật camp đọc mới dữ liệu rồi chọn và tới checkout trên fixture.
2. Giá đổi giữa lúc chọn và bật camp: không mở tab/phiên giữ vé, trả lỗi để tải lại cấu hình.
3. Nhiều suất cần chọn rõ; calendarId không thuộc event không được tự thay bằng suất duy nhất/đầu tiên.
4. Ticketbox hiển thị đúng giá, mở/xem lại kết quả; không tạo cấu hình/adapter camp Ticketbox.
5. Response tìm cũ trả chậm không ghi đè response mới. Popup 460×600 không tràn ngang; nút camp vẫn ở trong viewport.
6. Preset Hà Nội điền đúng link, 12h ngày 19/10 và 1 vé; chọn hạng, giới hạn số vé theo API, lưu/mở lại giữ cấu hình; không tự arm.
7. Thẻ tiêu đề p, giá gốc gạch ngang, modal `btn-add/sub/continue`, số lượng span: tự chọn hạng, đặt 2 vé và tới checkout mô phỏng.

Các ca E2E bổ sung thực thi bằng content script/background của bản extension production:

1. Tự chọn VIP, cập nhật 2 vé, bấm tiếp và nhận diện checkout. Kiểm tra đúng hai click của website: Chọn, Tiếp tục; nút xác nhận đơn hàng chưa bị bấm.
2. Một tab sở hữu phiên. Tab thứ hai bị từ chối khởi động; phòng chờ chuyển sang chọn vé thì tự tiếp tục. Ẩn panel vẫn thực thi.
3. CAPTCHA làm PAUSED. Dừng camp xóa session; sau đó đưa tab vào bước chọn vé vẫn không tự chọn.
4. Demo booking có tương tác chạy cùng core/runner/adapter với transport bộ nhớ, không ghi cấu hình/phiên thật.
5. Khởi động từ popup: chờ mốc bán ở tương lai, tự bấm link mua, điều hướng event → booking và tiếp tục cùng phiên tới checkout.
6. Tự chọn một ghế DOM có nhãn/khu/giá, xác nhận selected rồi tới checkout.
7. Trang còn khóa tại giờ bán: chỉ reload một lần, dấu được giữ qua điều hướng; sau đó tiếp tục cùng phiên tới checkout.

Năm ca hồi quy trước đó vẫn chạy: lưu/khôi phục cấu hình, mặc định 1 vé, SPA/event identity, DOM/highlight, dừng/ẩn panel, demo trạng thái, số lượng nhiều vé không biến thành một ghế, alarm và khôi phục cấu hình sau browser restart.

## Benchmark lặp và số đo đọc trang thật

`npm run bench:camp` chạy 2 tình huống, mỗi tình huống làm nóng 1 lần rồi đo 12 lần. Đây là extension production, website/API cục bộ. CTA chỉ được mở tại mốc hẹn, hai CTA trùng phải chọn đúng nút chính, chỉ một click mỗi bước và không bấm thanh toán cuối. Không gửi request ra 1Zone. File cấu hình: [playwright.bench.config.ts](../playwright.bench.config.ts); kịch bản: [camp.spec.ts](../tests/benchmark/camp.spec.ts).

| Phản hồi website mô phỏng | CTA mở → click mua, p50 / p95 | CTA mở → DOM checkout, p50 / p95 |
|---|---:|---:|
| 0 ms | 9,3 / 69 ms | 42 / 155,3 ms |
| 100 ms tại mở danh sách và checkout | 25,6 / 37,3 ms | 309 / 329,2 ms |

Đây là độ trễ đo trên máy kiểm tra; 24 mẫu không phải benchmark website thật hoặc bằng chứng nhanh nhất thị trường. Ngưỡng hồi quy first-click dưới 1 giây chỉ phát hiện chậm nghiêm trọng. Báo cáo `artifacts/camp-benchmark.json` giữ từng mẫu, sai lệch timer và kết quả kiểm tra hành động. Không suy ra tốc độ khi có queue, CAPTCHA, mạng hoặc tải server.

Smoke chỉ đọc trang Hà Nội thật: 792 phần tử, NOT_READY; 20 lượt rescan có p50 12,4 ms, p95 16,9 ms, lượt lạnh đầu tiên 214,4 ms. Phép đo này chỉ đo thao tác đọc/đánh giá DOM, không phải giữ vé hoặc checkout. Báo cáo `artifacts/target-readiness.json` ghi `campStarted=false`.

Ảnh `auto-checkout.png`, `workspace-catalog.png`, `hanoi-preset.png`, `popup-search.png`, `target-readiness.png` và ảnh smoke catalog được dùng kiểm tra UI. Artifacts là output cục bộ, không đưa vào Git. Popup tests mở trang extension dạng tab; icon/popup thật và thông báo Windows vẫn cần diễn tập trên máy dùng.

## Unit tests và ranh giới kiến trúc

- Core: đúng event/calendarId, route event/booking, giờ UTC+7, validation và storage hỏng, ưu tiên/ngân sách, số lượng, máy trạng thái và các điều kiện chặn.
- Reader: zone/assigned/seat/mixed, DOM ẩn, giá trước/sau tiền, thẻ giới thiệu, nhóm ghế, selected qua ARIA; hàm inspect không sửa DOM.
- Modal: dấu hiệu public 1Zone, số lượng span, giá gốc gạch ngang; quote sai giá/tên hoặc nhiều control mơ hồ bị từ chối. Quote bổ sung không làm mất selected đã đọc từ ARIA.
- Executor: input/select/stepper; phân biệt tiếp tục với thanh toán cuối; bỏ link khác suất/điều khiển ẩn; từ chối target đã bị gỡ.
- Service: tab owner, revision/CAS, hủy phiên, từ chối iframe, cấu hình đổi, progress hỏng và chuyển bước không hợp lệ.
- Runner: trì hoãn persist rồi STOP hoặc đổi DOM; không thực thi click cũ.
- Catalog: JSON flight với dấu ngoặc/escape; schema/envelope khác nhau của Ticketbox search/detail; sai event/suất, trùng ID, giá mơ hồ, ID lớn, địa điểm/ngày/giá đổi, giới hạn số lượng.
- GET service: gộp request/cache, preflight tải mới, không cookie/token/header auth, lỗi 429 không tự retry, từ chối URL/ID/query/nền tảng ngoài hợp đồng trước network.
- Kiểm tra dependency bằng tìm kiếm source: core không import Chrome/DOM/React; runner và controller không gọi module 1Zone trực tiếp.

Platform catalog chứa origin tra cứu và URL policy booking riêng. Validator/runner không giả định mọi website có route /events hay calendarId. Nguồn dữ liệu và booking là hai contract độc lập. Ticketbox chỉ có quyền GET API; chưa có content script/booking adapter. CTicket chưa kết nối.

## Khảo sát trang công khai và giới hạn

Khảo sát sáu URL thuộc năm event và smoke trên Ngày em đến ở bản 0.1.0 là các lần **chỉ đọc**, không phải bằng chứng tự mua thành công. Bản 0.3.0 bổ sung GET/search/detail và smoke catalog production; bản 0.4.0 đọc đúng target/CTA và dấu hiệu modal trong component public. `artifacts/catalog-live.json` ghi 5 GET công khai, `configSaved=false`, `campStarted=false`, `errors=[]`. Smoke target 0.4.0 lưu cấu hình riêng trong profile tạm để nhận diện, không tạo phiên tự động. Xem [khảo sát DOM](KHAO_SAT_1ZONE.md) và [nghiên cứu API](NGHIEN_CUU_API.md).

Đã đọc đúng URL/suất/hạng/giá Vương Bình Hà Nội. Người dùng xác nhận mặc định 12h ngày 19/10; API chưa xác nhận độc lập thời điểm này. DOM booking sau đăng nhập chưa được xác minh. TP.HCM không được dùng thay Hà Nội. Chưa kiểm tra giữ vé/checkout thật hoặc gửi POST tạo giỏ/đơn. Modal fixture dựa vào component public, chưa phải DOM của tài khoản đã vào mua. Một số UI không công khai selected/số lượng hoặc không nhận synthetic events sẽ cần adapter cụ thể hơn. Chưa chọn canvas/iframe, ghép ghế liền nhau, đọc đầy đủ timer giữ chỗ hoặc mọi dạng lỗi hết hạn. Không bấm thanh toán cuối.

Hướng dẫn: [README](../README.md), [cơ chế](CO_CHE_HOAT_DONG.md), [review/nguồn](REVIEW_VA_NGUON_THAM_KHAO.md).
