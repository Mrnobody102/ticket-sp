# Cài Camp vé cho bạn bè

1. Trên GitHub, mở **`dist` → `Camp-ve-latest.zip` → Download raw file** để tải bản mới nhất.
2. **Giải nén toàn bộ ZIP** vào một nơi cố định, ví dụ `Downloads/Camp-ve`.
3. Mở Chrome trên máy tính, nhập **`chrome://extensions`**.
4. Bật **Developer mode / Chế độ dành cho nhà phát triển** ở góc trên bên phải.
5. Bấm **Load unpacked / Tải tiện ích đã giải nén**, chọn **`Downloads/Camp-ve/tien-ich`** — thư mục có **`manifest.json`**. Không chọn ZIP hoặc thư mục `dist`.
6. Ghim icon **Camp vé**. Mở tool và kiểm tra **v0.6.4**.

Nếu tải cả repo bằng **Code → Download ZIP**, giải nén repo rồi lấy **`dist/Camp-ve-latest.zip`** và tiếp tục từ bước 2. Không cần cài Node.js hay chạy lệnh.

## Test event

Đăng nhập 1Zone trước. Mở tool → **Mở rộng ↗**, dán link dưới đây vào ô **Tìm concert** rồi bấm **Tìm**:

```text
https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6
```

Chọn hạng ưu tiên, **1 hoặc 2 vé**, nhập giờ bán được ban tổ chức công bố → **Lưu cấu hình** → **Bắt đầu camp**. Giữ Chrome mở và máy thức. Gặp CAPTCHA thì tự xác minh; tới checkout kiểm tra đúng hạng, số vé và ghế trước khi thanh toán.

Trang hiện chưa mở bán. Nếu tool báo chưa đọc được sơ đồ/ghế, xử lý trực tiếp trên website; không coi trạng thái “Đang camp” là đã giữ được vé. Trước ngày test, có thể mở **Diễn tập → Chạy thử**.

## Cập nhật bản mới

Dừng camp → tải và giải nén ZIP mới → trong `chrome://extensions` **Remove** bản cũ rồi **Load unpacked** thư mục `tien-ich` mới; cấu hình lại. Hoặc thay toàn bộ thư mục cài cũ bằng `tien-ich` mới rồi **Reload** để giữ cấu hình. Sau đó **tải lại tab 1Zone** và kiểm tra phiên bản.
