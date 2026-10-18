# Ticketbox · khảo sát 18/10/2026

Hiện chỉ bật tra cứu. Chưa xác minh đặt vé bằng tài khoản đăng nhập, nên chưa bật tự động giữ vé hoặc thanh toán.

| Case công khai | Kết quả API từng suất |
|---|---|
| Mắt Nhắm Mắt Mở Day 3 · 26657 | Suất 53858377012103, 11 hạng, sơ đồ 932 |
| GAI MEET Nhà Rực Rỡ · 26712 | Suất 11992249512361, 4 hạng, sơ đồ 953 |
| Workshop chawan · 26692 | 6 suất; suất đầu 91149656186822, 1 hạng, seatMapId=0 |
| PSYCHIC FEVER · 26681 | sold_out; danh sách có placeholder showing.id=0, không phải ID đặt vé |

## Phần đã triển khai

- Lấy hạng/giá từ GET `/gin/api/v2/events/showings/{showingId}` thay vì dùng lại summary của sự kiện.
- Đọc min/max, giờ bán của từng hạng, hết vé, sơ đồ và phòng chờ. Không lấy giờ diễn làm giờ mở bán.
- Đối chiếu ID suất và sự kiện. Endpoint thật có thể trả `eventId=0`; chỉ chấp nhận khi `event.id` thật khớp. Mọi ID khác 0 phải thống nhất.
- Sự kiện hết vé có suất placeholder ID 0 vẫn mở được chi tiết; không tạo lựa chọn từ ID này.

## Luồng mua đã xác định từ client công khai

`/events/{eventId}/bookings/{showingId}/select-ticket` → `question-form` → `payment-info`.

Sự kiện có queue dùng `/queue/{showingId}` hoặc `/waiting-room/{showingId}`; presale có route riêng. Sơ đồ có thể gồm zone/section/modal hạng, khác renderer Konva của 1Zone. Không áp dụng tọa độ hoặc selector 1Zone cho Ticketbox.

Mở route select-ticket bằng profile ẩn danh cho ra hộp đăng nhập thật. Không nhập tài khoản, không tạo đơn, không gửi yêu cầu giữ vé. Vì vậy chưa xác minh DOM sau đăng nhập, chọn ghế, biểu mẫu bắt buộc hoặc phản hồi tạo giữ chỗ.

Chạy lại khảo sát: `node scripts/research-ticketbox.mjs`. Có thể truyền ID sự kiện để chọn case; kết quả và ảnh nằm trong `artifacts/ticketbox-research`. Script chặn request ghi tới booking/order/hold. Benchmark cục bộ không thay cho phép thử đặt vé thật.

Nguồn trực tiếp: [API sự kiện](https://api-v2.ticketbox.vn/gin/api/v2/events/26657), [API suất](https://api-v2.ticketbox.vn/gin/api/v2/events/showings/53858377012103), [trang sự kiện](https://ticketbox.vn/mat-nham-mat-mo-concert-day-3-26657), cùng JS/manifest công khai được trang tải. Mã đã quan sát và bằng chứng nằm trong thư mục artifacts, không đóng gói vào extension.
