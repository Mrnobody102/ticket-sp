# Queue và ghế cuối · 0.7.1

Kiểm tra ẩn danh ngày 26/10/2026, không chọn/giữ vé thật:

- `/events/capitaneus-mutabilis-2026?calendarId=XDacU6` vẫn ở trang sự kiện, có nút Mua vé.
- `/booking/capitaneus-mutabilis-2026?calendarId=XDacU6` chuyển tới `queue.1zone.vn`, client `eventista`, event `kaapup`, đích trả về đúng booking/suất. Có gặp `/softblock/` trong Chromium ẩn danh.
- Vì vậy, chỉ mở trang giới thiệu **chưa chứng minh đã vào hàng chờ**. Chưa có bằng chứng cấu hình lịch sử của 1Zone phân thứ tự ngẫu nhiên hay FIFO, hoặc giải thích được vị trí 2268 của người dùng.
- Queue-it cấp quyền trở lại website bằng token có chữ ký; thứ tự do cấu hình website quyết định. Chưa xác minh được cách bỏ hàng chờ của event này. Giữ một tab/phiên đang xếp hàng, để website tự cho vào. [Cơ chế chính thức](https://www.queue-it.com/developers/how-queue-it-works/), [cookie duy trì phiên](https://queue-it.com/cookie-statement-user/).

Các lỗi đã sửa:

- Xác minh đầu trang booking trước khi chọn ghế từng khiến tool PAUSED. Nay chờ xác minh và tự tiếp tục, không bắt bấm camp lại.
- SDK đọc ghế không có timeout từng có thể để bridge chờ mãi. Nay giới hạn 2 giây/lần đọc, tự đọc lại, hiện lỗi sau 3 lần thất bại. Timeout chọn ghế không được phép gửi chọn lặp khi chưa rõ kết quả.
- Đổi kế hoạch ghế khi đang lưu trạng thái: bỏ lệnh chưa gửi, tìm lại thay vì dừng toàn bộ.
- Đọc báo cáo số ghế khả dụng của SDK để bỏ qua hạng thiếu số lượng; khi hết lựa chọn hiện chờ ghế, không ghi “Đang tải” mãi. Đơn 2 vé không tự giảm thành 1. [API báo cáo SDK](https://docs.seats.io/docs/renderer/chart-properties-chartgetreportbyselectability/).
- Thêm nhịp nhận diện cục bộ mỗi giây để phát hiện SDK/queue đổi trạng thái dù DOM cha không đổi. Không gửi thêm request tới server để lấy lượt queue.
- Bỏ khung highlight trên iframe Seats.io, khử highlight trùng. Chưa tái hiện được map tối dần của phiên người dùng; chưa kết luận nguyên nhân. Client 1Zone cũng tự giảm độ đậm của ghế sold/not-for-sale; đây chỉ là một khả năng.
- Báo cáo phiên lưu thêm nhãn ghế đã chọn; không xuất cookie hoặc token.

Đã thêm mô phỏng queue → xác minh → ghế duy nhất → checkout, thiếu 2 ghế, SDK mất phản hồi và SDK treo. Kết quả mô phỏng không bảo đảm tồn kho hoặc thanh toán thật. Không có log phiên cũ nên không quy được lỗi người dùng gặp cho một nguyên nhân duy nhất.
