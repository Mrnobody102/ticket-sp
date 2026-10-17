# Kết quả kiểm tra · 17/10/2026

Môi trường: Windows, Node.js 22.11.0, npm 10.9.0; WXT 0.21.4, Vite 6.4.4, Vitest 4.1.12; Chromium 156 cho Playwright. Chạy bằng profile tạm, không sử dụng tài khoản Chrome/1Zone cá nhân.

| Kiểm tra | Kết quả |
|---|---|
| `npm run check` | PASS: TypeScript strict, không biến/tham số thừa + 67 unit tests / 4 files + production build |
| `npm run test:e2e` | PASS: 5 ca, 16.7 giây; mặc định 1 vé, ghế đơn/khu vực, event → booking, phòng chờ, storage/alarm |
| `npm run dev` | PASS: localhost:3000, tạo `.output/chrome-mv3-dev`; đã dừng server sau kiểm tra |
| `npm run zip` | Gói bàn giao: `.output/ticket-sp-0.1.0-chrome.zip` |
| Đối chiếu output | ZIP 170.042 byte khớp SHA-256 từng file với cả 10 file production; version khớp package, đúng host; không có Vite dev client |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit --audit-level=low` | 0 vulnerabilities, gồm công cụ build/test |
| Manifest production | MV3; storage, alarms, notifications; chỉ host ticket.1zone.vn |

Bản unpacked `.output/chrome-mv3`, tổng file khoảng 531 kB, đã được Chromium load và thực thi content script/background thật. Đánh giá source và nguồn cơ chế chuẩn ở [REVIEW_VA_NGUON_THAM_KHAO.md](REVIEW_VA_NGUON_THAM_KHAO.md).

## Phạm vi kiểm thử

- Core: URL hợp lệ/host giả, giữ `calendarId`, phân biệt event, UTC+7 độc lập timezone máy, dữ liệu storage hỏng, số lượng/ngân sách, ưu tiên VIP khác VVIP, trạng thái chặn và nhắc giờ chống lặp.
- Adapter: fixtures ZONE_ONLY, ASSIGNED_SEAT, PICK_SEAT, canvas unsupported, phòng chờ, xác minh, checkout, chưa mở bán, UNKNOWN, trang concert; chữ ẩn, hướng dẫn thanh toán, giá dải mơ hồ; đảm bảo inspect không sửa DOM.
- Hồi quy từ case thực tế: ký hiệu tiền trước/sau số, không coi thẻ giới thiệu hoặc nút xem chi tiết là vé khả dụng; giữ đúng slug/calendarId giữa route event và booking, không gộp suất khác.
- Rà soát ghế/khu: loại ghế đơn khi yêu cầu nhiều vé, khớp zone nếu nhóm ghế có nhãn rõ ràng, bỏ lựa chọn đã chọn theo ARIA, phân loại MIXED, không giữ cache visibility qua lần đọc mới. Một lần inspect trả cả snapshot và DOM bindings.
- E2E: popup lưu → reload → panel → highlight → DOM thay đổi → SPA đổi event → dừng → ẩn/hiện; mở concert dùng lại tab; không request giao dịch; demo không ghi đè cấu hình; đúng một alarm và hủy khi dừng.
- Đóng/mở lại Chromium cùng profile test: giữ cấu hình, khôi phục một alarm đã xóa trước khi đóng browser. Unit test riêng xác minh dấu đã nhắc sống trong storage, không nhắc lặp ở lần reconcile mới.
- E2E mới: popup chưa cấu hình mặc định 1; lưu số khác rồi reload vẫn khôi phục lựa chọn đã lưu. Ghế có nhãn đọc được được gợi ý cho 1 vé, không hiển thị như nhóm 2 vé. Phòng chờ mất slug vẫn báo trạng thái chờ kèm cảnh báo chưa xác nhận event.
- Review trước commit: ba kiểu container có tiêu đề chứa ghế cùng giá vẫn được đọc thành từng ghế; E2E xác minh trường hợp này. Tiêu đề chưa mở bán được ưu tiên hơn các điều khiển vé còn hiển thị, không trả gợi ý/bindings. Bốn unit tests hồi quy này đều thất bại trước khi sửa và PASS sau khi sửa.

## Trang công khai

`npm run smoke:live` mở [Ngày em đến](https://ticket.1zone.vn/events/ngay-em-den) trong browser tạm, chỉ đọc và bấm nút nhận diện lại **của extension**. Không bấm Mua vé/chọn vé/checkout.

Quan sát: một panel, `EVENT_PAGE`, đọc giới hạn 2 vé và hình thức chọn khu vực; 0 gợi ý trên trang giới thiệu, 0 lỗi JavaScript. Không dùng event mẫu làm bằng chứng về sale 18/10 hoặc tương thích bước chọn vé mục tiêu.

Ảnh và kết quả local nằm trong `artifacts/`: `popup.png`, `demo.png`, `live-smoke.png`, `live-smoke.json`. Các ảnh popup/demo đã được xem để kiểm tra bố cục. Popup trong E2E mở dưới dạng tab extension; kiểm tra icon/popup thật và thông báo Windows trên máy sử dụng vẫn cần diễn tập thủ công.

## Chưa xác minh

Đã khảo sát 6 URL thuộc 5 event công khai, gồm hai link người dùng cung cấp; xem [KHAO_SAT_1ZONE.md](KHAO_SAT_1ZONE.md). Link booking Lavender chuyển về trang event trong phiên chưa đăng nhập, nên chưa kiểm tra lớp sơ đồ chọn ghế thực tế. Bản đồ ảnh công khai không được coi là bằng chứng về khả năng chọn ghế.

Chưa có URL suất Vương Bình Hà Nội được xác nhận; link TP.HCM chỉ là tham khảo. Chưa kiểm tra DOM chọn vé, giờ bán, tồn kho, phòng chờ hoặc host chuyển bước của suất mục tiêu ngày mai. Chưa có bộ đọc đồng hồ giữ chỗ/hết hạn hoặc thao tác chọn map. Không kiểm tra đặt vé/thanh toán thật. Ticketbox và CTicket vẫn unsupported.
