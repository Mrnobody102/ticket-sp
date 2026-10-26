# CAPITANEUS MUTABILIS · XDacU6

Đối chiếu công khai ngày 26/10/2026, không đăng nhập hoặc tạo đơn thật.

- Event: `kAapup`, suất `XDacU6`, 22/11/2026 lúc 19:00 UTC+7.
- Trước giờ bán trang hiển thị **Sắp mở bán**. Kiểm tra lại sau đó: trang sự kiện có nút mua; `/booking/...XDacU6` chuyển tới queue `eventista / kaapup`. [Kết quả điều tra queue và ghế](QUEUE_VA_GHE.md).
- API summary và zones cùng trả 4 hạng: SPRING 990.000đ, SUMMER 1.690.000đ, AUTUMN 2.690.000đ, WINTER 3.690.000đ.
- Mỗi hạng khai báo `seatType: auto`, tối đa 2 vé và bật CAPTCHA. Đây là dữ liệu cấu hình, không chứng minh tồn kho thật.
- Preset mặc định mở bán **12:00 ngày 26/10/2026 UTC+7**, theo yêu cầu người dùng; không suy từ giờ diễn.
- Event dùng `collaboration: seatmap`; mã giao diện công khai có Seats.io trong iframe. Không đồng nhất sơ đồ này với map khu Konva đã hỗ trợ.

**0.7.0 có adapter tự chọn ghế Seats.io.** Bridge đọc riêng phản hồi GET inventory mà website đã tải qua fetch/XHR, chỉ giữ ID hạng/khu/ghế và nhãn hàng/số ghế. Không đọc header, cookie, token hoặc gọi API tạo đơn riêng. Nhãn ghế được ghép đúng công thức trong `useSeatmapSelectionLogic` của website: `zoneName-rowName-code`.

Tool tìm chart đúng `capitaneus-mutabilis-2026-XDacU6`, chế độ `normal`, phiên chọn không tự giữ ghế (`session: none`). Dùng `findObject` xác nhận category, nhãn, tồn kho; `doSelectObjects` chọn cả nhóm một lần để website nhận callback và dựng giỏ thật. Ưu tiên liền nhau, hàng trước, giữa hàng; nếu không còn cặp liền nhau, chọn ghế còn trống cùng khu. Không trộn zone.

Trước CTA tạo đơn, tool đối chiếu từng chip ghế, đơn giá và tổng tiền trong `.ticket-list-fixed-bar`. Sau đó bấm nút của website để mở xác minh và tạo đơn. Không giải CAPTCHA, không tự thanh toán. Xác minh lâu không làm gửi giữ vé lần hai; hết ghế trước khi chọn được đọc lại, phản hồi không rõ kết quả không được gửi lặp.

Kiểm thử có 4 hạng × 1/2 ghế qua SDK, cả fetch/XHR; tồn kho đổi, giá sai, xác minh lâu, SDK lỗi và dừng khi phản hồi muộn. **Chưa xác minh checkout đăng nhập thật**; lần kiểm tra mới dừng ở queue. Schema được đối chiếu từ mã giao diện và SDK công khai. Không coi fixture là chứng nhận mua thành công.

SDK chính thức: [chọn nhóm](https://docs.seats.io/docs/renderer/chart-properties-chartdoselectobjects/), [đọc ghế](https://docs.seats.io/docs/renderer/chart-properties-chartfindobject/), [đọc lựa chọn](https://docs.seats.io/docs/renderer/chartlistselectedobjects/). Không dùng `holdBestAvailable` vì website tự tạo đơn sau bước xác minh, với phiên Seats.io không tự giữ ghế.

### Đối chiếu SDK thật và event tham khảo

Đã render sơ đồ CAPITANEUS bằng SDK chính thức ở chế độ **static, chỉ đọc**: event key đúng, category 1 → WINTER, 2 → AUTUMN, 3 → SUMMER, 4 → SPRING. Adapter không đồng nhất numeric category key với ticket class ID MongoDB.

Có thể dùng [Vạn Âm Vang · QD6Rnn](https://ticket.1zone.vn/booking/van-am-vang?calendarId=QD6Rnn) để test thêm. Event `U1aOl8`, `collaboration: seatmap`, inventory công khai có **1.947 bản ghi** đúng các trường adapter sử dụng. SDK thật tìm được nhãn ghế mẫu ở **8 khu**, trả `objectType: Seat`, `status: free`, `selectable: true`; category label khớp các khu. Đây là bằng chứng schema chung, không mặc định cấu hình hai event giống nhau.

Summary Vạn Âm Vang vẫn có `isCaptchaEnable: true`, tối đa 4 vé/hạng. Widget có thể tự xác nhận sau khi tiếp tục; không suy là không có CAPTCHA chỉ vì chưa thấy trên màn chọn ghế. Đọc bằng profile ẩn danh có thể bị trả về trang event; không dùng phiên tài khoản của người dùng và chưa tạo đơn thật ở event tham khảo.

Nguồn GET công khai:

- [Trang sự kiện](https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6)
- [Hạng vé](https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/kAapup?type=group&calendarId=XDacU6)
- [Khu tương ứng](https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/kAapup/zones?calendarId=XDacU6)
