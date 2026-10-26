# Cài Camp vé cho bạn bè

1. Trên GitHub, mở **`dist` → `Camp-ve-latest.zip` → Download raw file** để tải bản mới nhất.
2. **Giải nén toàn bộ ZIP** vào một nơi cố định, ví dụ `Downloads/Camp-ve`.
3. Mở Chrome trên máy tính, nhập **`chrome://extensions`**.
4. Bật **Developer mode / Chế độ dành cho nhà phát triển** ở góc trên bên phải.
5. Bấm **Load unpacked / Tải tiện ích đã giải nén**, chọn **`Downloads/Camp-ve/tien-ich`** — thư mục có **`manifest.json`**. Không chọn ZIP hoặc thư mục `dist`.
6. Ghim icon **Camp vé**. Mở tool và kiểm tra **v0.8.0**.

Nếu tải cả repo bằng **Code → Download ZIP**, giải nén repo rồi lấy **`dist/Camp-ve-latest.zip`** và tiếp tục từ bước 2. Không cần cài Node.js hay chạy lệnh.

## Test event

Đăng nhập 1Zone trước. Mở tool → **Mở rộng ↗** → chọn **CAPITANEUS MUTABILIS**. Hoặc dán link này vào ô tìm:

```text
https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6
```

Chọn hạng ưu tiên, **1 hoặc 2 vé** → đặt giờ ban tổ chức công bố → **Lưu và camp**. Nếu đang bán, chọn **Ngay khi bật camp**. Tool tự chọn ghế và đi tới checkout. Giữ Chrome mở, máy thức; widget tự xác nhận xong thì tool tiếp tục.

Tới checkout, kiểm tra đơn rồi thanh toán. “Đang camp” chưa có nghĩa đã giữ được vé. Có thể thử trước bằng **Diễn tập → Chạy thử**.

Nếu vào queue, giữ nguyên tab: đến lượt và xác minh xong, tool tự tiếp tục. Muốn mua ghế lẻ cuối cùng thì đặt **1 vé**; tool không tự giảm đơn 2 vé thành 1.

Test tham khảo: dán `https://ticket.1zone.vn/booking/van-am-vang?calendarId=QD6Rnn` vào ô tìm. Chọn đúng hạng và **Ngay khi bật camp**. Hai event có sơ đồ ghế; cấu hình và tồn vé vẫn được kiểm tra riêng.

**Sự kiện khác:** tìm tên hoặc dán link, chọn đúng suất và hạng. **Ticketbox hiện chưa tự mua**; panel chỉ nhận diện bước đang mở và lưu báo cáo.

**Nếu mắc:** mở popup → **Trang vé và hiển thị → Lưu nhật ký camp**. Nhật ký tự lưu 3 lượt gần nhất qua chuyển trang, không chứa mật khẩu/cookie/token. Gửi file này khi cần kiểm tra lỗi.

## Cập nhật bản mới

Dừng camp → tải và giải nén ZIP mới → trong `chrome://extensions` **Remove** bản cũ rồi **Load unpacked** thư mục `tien-ich` mới; cấu hình lại. Hoặc thay toàn bộ thư mục cài cũ bằng `tien-ich` mới rồi **Reload** để giữ cấu hình. Sau đó **tải lại tab 1Zone** và kiểm tra phiên bản.
