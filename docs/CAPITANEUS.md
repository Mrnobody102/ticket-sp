# CAPITANEUS MUTABILIS · XDacU6

Đối chiếu công khai ngày 26/10/2026, không đăng nhập hoặc tạo đơn thật.

- Event: `kAapup`, suất `XDacU6`, 22/11/2026 lúc 19:00 UTC+7.
- Trang hiển thị **Sắp mở bán**. Không suy giờ bán từ giờ diễn.
- API summary và zones cùng trả 4 hạng: SPRING 990.000đ, SUMMER 1.690.000đ, AUTUMN 2.690.000đ, WINTER 3.690.000đ.
- Mỗi hạng khai báo `seatType: auto`, tối đa 2 vé và bật CAPTCHA. Đây là dữ liệu cấu hình, không chứng minh tồn kho thật.
- Event dùng `collaboration: seatmap`; mã giao diện công khai có Seats.io trong iframe. Không đồng nhất sơ đồ này với map khu Konva đã hỗ trợ.

Tool đọc catalog đúng event/suất, đối chiếu hạng/giá/số lượng và chỉ thao tác điều khiển mà adapter xác minh được. Hạng tự cấp có thẻ chọn và modal số lượng dùng luồng hiện có. Nếu website yêu cầu click từng ghế trong iframe hoặc không công bố điều khiển đọc được, tool dừng để người dùng chọn trên website. Không bấm tọa độ hoặc suy ghế từ màu.

Kiểm thử mô phỏng kiểm tra catalog → trang chưa bán → thẻ hạng tự cấp cạnh iframe → modal → chờ CAPTCHA → checkout cho 1/2 vé, cũng như chặn sơ đồ chỉ có iframe, giá sai và nhiều ghế. **Chưa xác minh checkout thật của suất này**, vì trang còn khóa và không có phiên đăng nhập. Bạn test cần kiểm tra đơn trên website; không có bảo đảm mua thành công.

Nguồn GET công khai:

- [Trang sự kiện](https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6)
- [Hạng vé](https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/kAapup?type=group&calendarId=XDacU6)
- [Khu tương ứng](https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/kAapup/zones?calendarId=XDacU6)
