# Kết quả kiểm tra · 0.3.0 · 18/10/2026

Môi trường Windows, Node.js 22.11.0, npm 10.9.0; WXT 0.21.4, Vite 6.4.4, Vitest 4.1.12; Chromium 156 qua Playwright. Browser tests dùng profile tạm và fixtures, không dùng tài khoản hoặc tạo đơn thật.

| Kiểm tra bản 0.3.0 | Kết quả |
|---|---|
| `npm run check` | PASS: TypeScript strict/noUnused + 120 unit tests / 10 files + production build; typecheck/build chạy lại sau chỉnh UI cuối |
| `npm run test:e2e` | PASS: 16 ca, gồm 5 ca catalog và 11 ca hồi quy |
| `npm run smoke:catalog` | PASS: UI extension production đọc API thật; 1Zone Hà Nội 4 hạng, Ticketbox 11 hạng; không lưu cấu hình, không bật camp, không có page error |
| `npm audit --audit-level=low` | 0 vulnerabilities, gồm công cụ phát triển |
| `npm run zip` | `.output/ticket-sp-0.3.0-chrome.zip`; đối chiếu SHA-256 từng file với output production |
| Output | Khoảng 614 kB unpacked; 13 file production; manifest MV3/version 0.3.0 |
| Quyền host | 1Zone public/API và Ticketbox API; content entrypoint `tickets` chỉ chạy trên `ticket.1zone.vn` |
| Tài liệu | Đã kiểm tra liên kết file cục bộ; không có lỗi whitespace qua git diff check |

## Kiểm thử luồng camp

Năm ca catalog mới chạy qua message/GET transport thật của background, với response tổng hợp theo schema đã quan sát:

1. Tìm sự kiện, chọn hạng/giá, lưu đúng event/performance/ticket ID; mặc định 1 vé; sửa chưa lưu khóa nút bắt đầu; bật camp đọc mới dữ liệu rồi chọn và tới checkout trên fixture.
2. Giá đổi giữa lúc chọn và bật camp: không mở tab/phiên giữ vé, trả lỗi để tải lại cấu hình.
3. Nhiều suất cần chọn rõ; calendarId không thuộc event không được tự thay bằng suất duy nhất/đầu tiên.
4. Ticketbox hiển thị đúng giá, mở/xem lại kết quả; không tạo cấu hình/adapter camp Ticketbox.
5. Response tìm cũ trả chậm không ghi đè response mới. Popup 460×600 không tràn ngang; nút camp vẫn ở trong viewport.

Các ca E2E bổ sung thực thi bằng content script/background của bản extension production:

1. Tự chọn VIP, cập nhật 2 vé, bấm tiếp và nhận diện checkout. Kiểm tra đúng hai click của website: Chọn, Tiếp tục; nút xác nhận đơn hàng chưa bị bấm.
2. Một tab sở hữu phiên. Tab thứ hai bị từ chối khởi động; phòng chờ chuyển sang chọn vé thì tự tiếp tục. Ẩn panel vẫn thực thi.
3. CAPTCHA làm PAUSED. Dừng camp xóa session; sau đó đưa tab vào bước chọn vé vẫn không tự chọn.
4. Demo booking có tương tác chạy cùng core/runner/adapter với transport bộ nhớ, không ghi cấu hình/phiên thật.
5. Khởi động từ popup: chờ mốc bán ở tương lai, tự bấm link mua, điều hướng event → booking và tiếp tục cùng phiên tới checkout.
6. Tự chọn một ghế DOM có nhãn/khu/giá, xác nhận selected rồi tới checkout.

Năm ca hồi quy trước đó vẫn chạy: lưu/khôi phục cấu hình, mặc định 1 vé, SPA/event identity, DOM/highlight, dừng/ẩn panel, demo trạng thái, số lượng nhiều vé không biến thành một ghế, alarm và khôi phục cấu hình sau browser restart.

## Số đo tốc độ trong fixture

Lượt cuối trên máy kiểm tra:

| Khoảng đo | Thời gian |
|---|---|
| Từ bắt đầu chọn zone tới nhận diện checkout | Xem `selectionToCheckoutMs` trong `artifacts/auto-timing.json` |
| Từ click Bắt đầu camp của test tới lúc test quan sát checkout | Xem `startToObservedCheckoutMs` trong cùng file |

Kịch bản này là VIP, 2 vé; website phản hồi cục bộ, không queue/mạng/server thật. Đây là một số đo chức năng/độ trễ trên fixture, không phải benchmark hoặc cam kết tốc độ 1Zone. Test chỉ chặn hồi quy nghiêm trọng với ngưỡng chọn → checkout dưới 5 giây.

Số đo thay đổi theo lịch Chromium và tải máy, không đặt số cố định trong tài liệu. Ảnh `auto-checkout.png`, `workspace-catalog.png`, `popup-search.png`, `catalog-live-onezone.png`, `catalog-live-ticketbox.png` được dùng kiểm tra UI. Artifacts là output cục bộ, không đưa vào Git. Popup tests mở trang extension dạng tab; icon/popup thật và thông báo Windows vẫn cần diễn tập trên máy dùng.

## Unit tests và ranh giới kiến trúc

- Core: đúng event/calendarId, route event/booking, giờ UTC+7, validation và storage hỏng, ưu tiên/ngân sách, số lượng, máy trạng thái và các điều kiện chặn.
- Reader: zone/assigned/seat/mixed, DOM ẩn, giá trước/sau tiền, thẻ giới thiệu, nhóm ghế, selected qua ARIA; hàm inspect không sửa DOM.
- Executor: input/select/stepper; phân biệt tiếp tục với thanh toán cuối; bỏ link khác suất/điều khiển ẩn; từ chối target đã bị gỡ.
- Service: tab owner, revision/CAS, hủy phiên, từ chối iframe, cấu hình đổi, progress hỏng và chuyển bước không hợp lệ.
- Runner: trì hoãn persist rồi STOP hoặc đổi DOM; không thực thi click cũ.
- Catalog: JSON flight với dấu ngoặc/escape; schema/envelope khác nhau của Ticketbox search/detail; sai event/suất, trùng ID, giá mơ hồ, ID lớn, địa điểm/ngày/giá đổi, giới hạn số lượng.
- GET service: gộp request/cache, preflight tải mới, không cookie/token/header auth, lỗi 429 không tự retry, từ chối URL/ID/query/nền tảng ngoài hợp đồng trước network.
- Kiểm tra dependency bằng tìm kiếm source: core không import Chrome/DOM/React; runner và controller không gọi module 1Zone trực tiếp.

Platform catalog chứa origin tra cứu và URL policy booking riêng. Validator/runner không giả định mọi website có route /events hay calendarId. Nguồn dữ liệu và booking là hai contract độc lập. Ticketbox chỉ có quyền GET API; chưa có content script/booking adapter. CTicket chưa kết nối.

## Khảo sát trang công khai và giới hạn

Khảo sát sáu URL thuộc năm event và smoke trên Ngày em đến ở bản 0.1.0 là các lần **chỉ đọc**, không phải bằng chứng tự mua thành công. Bản 0.3.0 bổ sung quan sát GET/search/detail và smoke qua extension production. Báo cáo `artifacts/catalog-live.json` ghi đúng 5 GET công khai, `configSaved=false`, `campStarted=false`, `errors=[]`. Xem [khảo sát DOM](KHAO_SAT_1ZONE.md) và [nghiên cứu API](NGHIEN_CUU_API.md).

Đã đọc đúng URL/suất/hạng/giá Vương Bình Hà Nội; giờ mở bán và DOM booking sau đăng nhập chưa được xác minh. TP.HCM không được dùng thay Hà Nội. Chưa kiểm tra giữ vé/checkout thật hoặc gửi POST tạo giỏ/đơn. Một số UI không công khai selected/số lượng hoặc không nhận synthetic events sẽ cần adapter cụ thể hơn. Chưa chọn canvas/iframe, ghép ghế liền nhau, đọc đầy đủ timer giữ chỗ hoặc mọi dạng lỗi hết hạn. Không bấm thanh toán cuối.

Hướng dẫn: [README](../README.md), [cơ chế](CO_CHE_HOAT_DONG.md), [review/nguồn](REVIEW_VA_NGUON_THAM_KHAO.md).
