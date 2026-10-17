# Nội dung chuẩn bị cho Chrome Web Store

Chưa đăng Store. Cần tài khoản nhà phát triển, email hỗ trợ và URL chính sách do chủ tool quản lý. Không ghi khả năng chưa kiểm chứng thành cam kết thương mại.

## Nội dung listing

**Tên:** Camp vé · 1Zone Assistant — BETA

**Mô tả ngắn:** Chuẩn bị hạng vé, số lượng và giờ bán; tự chọn vé trên giao diện 1Zone được hỗ trợ và dừng ở thanh toán.

**Mô tả:**

Camp vé giúp chuẩn bị lựa chọn trước giờ mở bán. Tìm sự kiện, chọn suất và hạng theo dữ liệu website, sắp ưu tiên và đặt số lượng. Khi bật camp, tiện ích chờ giờ bán, thao tác trên các điều khiển đọc được và dừng khi nhận diện bước thanh toán.

Hỗ trợ camp trên một số giao diện 1Zone; Ticketbox hiện chỉ tra cứu. Có diễn tập cục bộ để thử chọn vé và số lượng, không tạo đơn. Người dùng tự đăng nhập, xử lý CAPTCHA và thanh toán. Không vượt phòng chờ, không bảo đảm mua được vé hoặc hỗ trợ mọi sơ đồ; canvas/iframe chưa có hợp đồng đọc được sẽ dừng.

## Quyền và dữ liệu cần khai báo

| Quyền | Mục đích trong bản hiện tại |
|---|---|
| storage | Cấu hình cục bộ; một phiên camp tạm thời trong session |
| alarms, notifications | Thông báo tới giờ mở bán đã lưu |
| ticket.1zone.vn | Đọc metadata sự kiện; content script đọc và thao tác giao diện đặt vé |
| marketplace.1zone.vn, prod.1zone.vn | GET tìm sự kiện và hạng/giá/số lượng tối đa |
| api-v2.ticketbox.vn | GET tìm sự kiện, suất và hạng vé |

Không có server riêng, analytics, quảng cáo hay bán dữ liệu trong bản này. Từ khóa và ID sự kiện được gửi tới nền tảng tương ứng để lấy dữ liệu. Phiên mua do website quản lý; extension không xuất cookie, mật khẩu hoặc thông tin thẻ. Không khai báo “không truyền bất kỳ dữ liệu nào” vì các yêu cầu tra cứu vẫn đi tới website bán vé.

## Hướng dẫn reviewer

Mở icon → Diễn tập → chọn 1 hoặc 2 vé → Chạy thử. Kết quả là Đã tới thanh toán, đúng số vé; nút xác nhận đơn vẫn chưa bấm. Làm lại để thử tiếp. Phần kiểm tra nhận diện chứa queue, CAPTCHA, ghế và canvas, không tạo giao dịch. Có thể tìm tên hoặc dán link công khai vào cấu hình để kiểm tra nguồn dữ liệu; giao dịch thật cần tài khoản website và thời điểm mở bán.

`npm run store:assets` tạo hai ảnh UI hiện tại ở `.output/store-assets`, đúng 1280×800 theo [yêu cầu ảnh của Chrome](https://developer.chrome.com/docs/webstore/images). Script dùng diễn tập cục bộ, không có tài khoản/đơn thật. Kiểm tra ảnh trước khi submit; cập nhật khi UI đổi.
