# Kết quả kiểm tra · 0.2.0 · 18/10/2026

Môi trường Windows, Node.js 22.11.0, npm 10.9.0; WXT 0.21.4, Vite 6.4.4, Vitest 4.1.12; Chromium 156 qua Playwright. Browser tests dùng profile tạm và fixtures, không dùng tài khoản hoặc tạo đơn thật.

| Kiểm tra bản 0.2.0 | Kết quả |
|---|---|
| `npm run check` | PASS: TypeScript strict/noUnused + 93 unit tests / 8 files + production build |
| `npm run test:e2e` | PASS: 11 ca / 57.9 giây ở lượt kiểm tra cuối |
| `npm audit --audit-level=low` | 0 vulnerabilities, gồm công cụ phát triển |
| `npm run zip` | `.output/ticket-sp-0.2.0-chrome.zip` |
| Output | Khoảng 574 kB unpacked; 10 file production; manifest MV3/version 0.2.0 |
| Quyền host | Chỉ `https://ticket.1zone.vn/*`; content entrypoint chung `tickets` |
| Tài liệu | Đã kiểm tra liên kết file cục bộ; không có lỗi whitespace qua git diff check |

## Kiểm thử luồng camp

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
| Từ bắt đầu chọn zone tới nhận diện checkout | **202 ms** |
| Từ click Bắt đầu camp của test tới lúc test quan sát checkout | **341 ms** |

Kịch bản này là VIP, 2 vé; website phản hồi cục bộ, không queue/mạng/server thật. Đây là một số đo chức năng/độ trễ trên fixture, không phải benchmark hoặc cam kết tốc độ 1Zone. Test chỉ chặn hồi quy nghiêm trọng với ngưỡng chọn → checkout dưới 5 giây.

Số đo/mốc session lưu ở `artifacts/auto-timing.json`; ảnh `auto-checkout.png`, `popup.png`, `demo.png` đã được xem. Artifacts là output cục bộ, không đưa vào Git. Popup tests mở trang extension dạng tab; icon/popup thật và thông báo Windows vẫn cần diễn tập trên máy dùng.

## Unit tests và ranh giới kiến trúc

- Core: đúng event/calendarId, route event/booking, giờ UTC+7, validation và storage hỏng, ưu tiên/ngân sách, số lượng, máy trạng thái và các điều kiện chặn.
- Reader: zone/assigned/seat/mixed, DOM ẩn, giá trước/sau tiền, thẻ giới thiệu, nhóm ghế, selected qua ARIA; hàm inspect không sửa DOM.
- Executor: input/select/stepper; phân biệt tiếp tục với thanh toán cuối; bỏ link khác suất/điều khiển ẩn; từ chối target đã bị gỡ.
- Service: tab owner, revision/CAS, hủy phiên, từ chối iframe, cấu hình đổi, progress hỏng và chuyển bước không hợp lệ.
- Runner: trì hoãn persist rồi STOP hoặc đổi DOM; không thực thi click cũ.
- Kiểm tra dependency bằng tìm kiếm source: core không import Chrome/DOM/React; runner và controller không gọi module 1Zone trực tiếp.

Catalog chứa URL policy riêng từng nền tảng. Validator chung không giả định mọi website có route /events hay calendarId. Ticketbox/CTicket chưa có integration/adapter và chưa được thêm quyền host.

## Khảo sát trang công khai và giới hạn

Khảo sát sáu URL thuộc năm event và smoke trên Ngày em đến ở bản 0.1.0 là các lần **chỉ đọc**, không phải bằng chứng tự mua thành công. Xem [KHAO_SAT_1ZONE.md](KHAO_SAT_1ZONE.md). Script khảo sát/smoke ở 0.2.0 cũng không khởi động automation.

Chưa có URL/DOM bước mua của suất Vương Bình Hà Nội được xác nhận; TP.HCM không được dùng thay suất Hà Nội. Chưa kiểm tra chọn/giữ vé hoặc checkout thật trên 1Zone. Một số UI không công khai selected/số lượng hoặc không nhận synthetic events sẽ cần adapter cụ thể hơn. Chưa chọn canvas/iframe, ghép ghế liền nhau, đọc đầy đủ timer giữ chỗ hoặc mọi dạng lỗi hết hạn. Không bấm thanh toán cuối.

Hướng dẫn: [README](../README.md), [cơ chế](CO_CHE_HOAT_DONG.md), [review/nguồn](REVIEW_VA_NGUON_THAM_KHAO.md).
