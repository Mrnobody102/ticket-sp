# Quyết định triển khai · 17/10/2026

Mục tiêu: extension cài được trước 18/10, thử hỗ trợ mua **1 vé mặc định** fan meeting Vương Bình **tại Hà Nội**, không giới hạn ngân sách. URL và giờ bán suất Hà Nội chưa xác nhận. Link TP.HCM và Lavender tại Cung Thiếu nhi chỉ là tham khảo; xem [khảo sát thực tế](KHAO_SAT_1ZONE.md). Tổng 100–200 vé là ước tính người dùng cung cấp, không phải tồn kho đã xác minh.

## Điều chỉnh brief

1. Một project WXT ở root; ranh giới core / adapter / infrastructure / UI, chưa monorepo/backend.
2. Chrome Alarms nhắc khi popup đóng; dựng lại khi worker khởi động. Dấu đã nhắc lưu bền, không mất khi lưu cấu hình. Promise trong worker chỉ xếp thứ tự ghi, không lưu task.
3. Giờ nhập cố định UTC+7, lưu ISO UTC; không phụ thuộc timezone Windows, không đoán giờ bán.
4. Chỉ gợi ý khi khớp concert/suất và đang SELECTING. Tôn trọng ưu tiên chính xác, ngân sách tổng, disabled, giới hạn số vé hiển thị. Không suy ra tồn kho đủ số lượng.
5. Demo nội bộ extension không thêm quyền localhost/ghi cấu hình giả vào task thật.
6. Shadow DOM và overlay không chặn pointer; MutationObserver throttle, theo dõi route SPA, cleanup listener. Không polling mạng/refresh.
7. Unit tests cho quyết định và nhận diện; Playwright load extension production, chặn request để phục vụ fixtures.
8. Nhận cùng slug/calendarId ở `/events/` và `/booking/`; hỗ trợ ký hiệu tiền trước/sau số. Loại nút xem thông tin khỏi điều khiển chọn vé để không coi thẻ giới thiệu là vé có thể mua.
9. Rà soát source: tách visibility/text, option reader và phân loại cách chọn; một lần inspect trả snapshot cùng DOM bindings, không đọc lại option để highlight. Cache chỉ sống trong lần đọc. Tách ghế đơn/khu vực, không gợi ý một ghế cho nhiều vé; giữ trạng thái phòng chờ với cảnh báo chưa xác nhận event nếu route không có slug.

## Thứ tự bàn giao

- P0: scaffold → core/config → adapter/panel → alarm → demo → tests/build → tài liệu.
- P1 khi có link: đọc trang công khai, kiểm tra luồng/DOM/giới hạn thực tế, bổ sung fixture rồi chỉnh adapter khi cần.
- Sau buổi thử: cân nhắc adapter khác, entitlement hoặc thương mại theo kết quả và quyền tích hợp.

## Ma trận xác minh

| Hạng mục | Bằng chứng hiện có | Còn thiếu |
|---|---|---|
| ticket.1zone.vn | Link chính thức từ 1zone.vn | Host các bước của fan meeting |
| Ba hình thức vé | Quy định trên ba event mẫu trong README | Quy trình event mục tiêu |
| Nhận diện, giá, ưu tiên, trạng thái chặn | Fixtures tổng hợp + unit/E2E | DOM bước chọn vé thật |
| Storage, panel, SPA, alarm | Extension production trong Chromium | Chrome cá nhân/notification Windows |
| Mở bán 18/10 | Đầu vào người dùng | Link/giờ chính thức |
| Quyền tích hợp/thương mại | Chưa xác nhận; điều khoản có hạn chế | Làm rõ riêng trước mở rộng |

Pass fixture không chứng nhận tương thích sự kiện thật. Kết quả thực thi ghi ở `docs/VALIDATION.md` khi hoàn tất.
