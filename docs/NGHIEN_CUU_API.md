# Nguồn dữ liệu, API và giới hạn booking · 0.4.0

Đối chiếu ngày 18/10/2026 bằng Chromium profile tạm và HTTP GET không đăng nhập. Đây là các endpoint do website chính thức sử dụng, **chưa phải API tích hợp có cam kết ổn định**. Không gửi POST giữ vé/tạo đơn, không sao chép token, cookie hoặc thông tin thanh toán.

## 1. Kết quả theo nền tảng

| Nền tảng | Đã kiểm tra | Đã triển khai trong tool | Phần chưa xác minh |
|---|---|---|---|
| [1Zone](https://ticket.1zone.vn/) | Tìm kiếm, danh sách, metadata event/suất, summary hạng/giá trả HTTP 200 với GET ẩn danh | Tìm kiếm, chọn suất, chọn hạng theo ID/giá, preflight; adapter DOM tới checkout | Booking thật của suất Hà Nội, queue token, xác minh và kết quả giữ vé |
| [Ticketbox](https://ticketbox.vn/) | Search và chi tiết chứa showing/ticketTypes trả HTTP 200 | Tra cứu sự kiện/suất/hạng/giá | Adapter mua vé, phòng chờ và checkout; không bật camp Ticketbox |
| [CTicket](https://cticket.vn/) | Trang công khai dừng ở màn xác minh trình duyệt trong lần quan sát | Chưa bật nguồn | Chưa có hợp đồng JSON/DOM đủ bằng chứng; không thử vượt màn xác minh |

Tìm kiếm chỉ chạy khi bấm Tìm/Enter; không liên tục gọi API theo từng ký tự. Kết quả server có giới hạn, không phải toàn bộ dữ liệu concert. 1Zone tìm theo từ khóa tối đa 50 kết quả; danh sách không có từ khóa và Ticketbox có phân trang.

## 2. 1Zone: dữ liệu được lấy ở đâu?

| GET đã quan sát | Dữ liệu dùng |
|---|---|
| `marketplace.1zone.vn/v2/marketplace/ticket-events?limit=24&page=1` | `data.items`, ID, tên, path, địa điểm, ngày, giá từ, phân trang |
| `marketplace.1zone.vn/v2/marketplace/search?keyword=…&limit=50` | `data.ticketEvents`; tìm ở server, gồm event có trạng thái CLOSE |
| `ticket.1zone.vn/events/{slug}` | JSON `eventData` trong các record Next flight: event ID, `eventCalendar`, `calendarId`, địa điểm, ngày diễn, currency |
| `prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/{eventId}?type=group&calendarId={calendarId}` | `ticketClassId`, tên, `finalPriceVn`, giới hạn, `seatType`, cờ CAPTCHA |

Ví dụ nguồn: [tìm Vương Bình](https://marketplace.1zone.vn/v2/marketplace/search?keyword=V%C6%B0%C6%A1ng%20B%C3%ACnh&limit=50), [summary suất Hà Nội](https://prod.1zone.vn/ticketing/api/v4/ticket-summary/get-summary-event/aAq6NT?type=group&calendarId=8h0YGm).

Parser dùng `JSON.parse` và đếm ngoặc có xử lý chuỗi/escape; **không eval hoặc chạy script của trang**. Nếu schema/slug/ID suất không khớp, trả lỗi đọc dữ liệu. Bỏ hạng `isShowInBooking=false`; không tự suy giá từ tên hay ảnh.

`availableTickets` là snapshot do endpoint trả. Không coi trường này là tồn kho đã giữ cho người dùng; trạng thái event, tổng tồn và số khả dụng có thể không đồng nhất trước mở bán. `seatType=auto` cho biết chế độ cấp chỗ trong dữ liệu, không chứng minh ghế ngẫu nhiên hay liền nhau. Quyết định thao tác vẫn cần DOM booking xác nhận.

## 3. Sự kiện Vương Bình tại Hà Nội đã tìm được

[TIỆC THÀNH-THÂN (MÂM 2): VƯƠNG BÌNH](https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm):

- Event ID `aAq6NT`, suất `8h0YGm`.
- Cung Thiếu nhi Hà Nội, cơ sở 2, 17 Phạm Hùng.
- Metadata ghi bắt đầu **11:00 ngày 21/11/2026, UTC+7**. Đây là giờ biểu diễn, không phải giờ mở bán.
- Lần đọc trả trạng thái `CLOSE`, `saleConfig=[]`; chưa xác định được giờ mở bán bằng dữ liệu này.

| Hạng tại lần đọc | Giá/vé | Giới hạn hạng được trả |
|---|---:|---:|
| HAI QUÝ - EB | 2.996.000 đ | 2 |
| BA THƯƠNG - EB | 2.196.000 đ | 2 |
| TƯ MẾN - EB | 1.696.000 đ | 4 |
| ÚT CƯNG - EB | 996.000 đ | 2 |

Summary trả `seatType=auto` và bật CAPTCHA ở các hạng trên. Giá/tên/giới hạn có thể đổi theo đợt. Tool không tự ghi sự kiện này vào cấu hình; người dùng chọn đúng suất và lưu. Hậu tố `- EB` khác `- GS` ở link TP.HCM; không tạo alias tự động giữa hai đợt.

Người dùng xác nhận 12:00 ngày 19/10/2026 UTC+7 làm mặc định có thể sửa. Mốc này thuộc preset, không suy từ giờ diễn hay trường CLOSE. Chọn/sắp ưu tiên và số vé được thực hiện trước giờ bán; form lấy giới hạn nhỏ nhất trong những giới hạn đã biết của suất và các hạng đã chọn. Khi arm, dữ liệu mới được đọc lại để chặn vượt giới hạn.

### Đối chiếu UI cho bản 0.4.0

Trang công khai hiện có hai CTA khóa; hero dùng `data-id="btn-by-ticket"`, bản sticky không có dấu này. Route booking ẩn danh chuyển về event. Public client kiểm tra trạng thái OPEN/CLOSE và canPurchase; chỉ đến giờ trên đồng hồ tool không làm CTA mở.

Component SelectTicketModal công khai dùng `btn-sub`, `btn-add`, số lượng trong span, `btn-continue`; giá gốc có thể gạch ngang cạnh giá hiện tại. Reader mới dùng các dấu này cùng tên/giá khớp catalog, và hỗ trợ thẻ có tiêu đề p với một nút chọn/mua. Không đọc React internals hoặc token. Đã dựng fixture và E2E tương ứng; chưa có DOM booking từ tài khoản đăng nhập thật. Chi tiết bằng chứng và phép đo ở [sẵn sàng mở bán](SAN_SANG_MO_BAN.md).

## 4. Ticketbox: cùng model, parser riêng

| GET đã quan sát | Dữ liệu dùng |
|---|---|
| `api-v2.ticketbox.vn/search/v3/events?q=…&filter=upcoming&page=1&limit=8` | `data.results`, deeplink, ID, ngày, giá từ, total |
| `api-v2.ticketbox.vn/gin/api/v2/events/{id}` | `data.result`, `showings`, `ticketTypes`, ID hạng, giá và giới hạn |

Đã đối chiếu [Mắt Nhắm Mắt Mở – Day 3 Hà Nội](https://ticketbox.vn/mat-nham-mat-mo-concert-day-3-26657) và [JSON chi tiết chính thức](https://api-v2.ticketbox.vn/gin/api/v2/events/26657). Tool giữ showing ID dạng chuỗi, không làm tròn ID lớn; số trả về phải là safe integer. Không suy ra cơ chế ghế, queue hoặc CAPTCHA từ schema tra cứu. UI chỉ hiển thị tra cứu và link website cho nguồn này.

## 5. Vì sao chưa gửi thẳng API đặt vé?

Client công khai của 1Zone có đường gọi `POST /ticketing/api/v3/order/add-to-cart` và bước tạo đơn thanh toán riêng. Phần tạo giỏ liên quan phiên đăng nhập, token xác minh và thông tin phòng chờ. Biết tên endpoint chưa xác định được hợp đồng đặt/giữ vé đúng cho suất mục tiêu.

Để triển khai transport booking trực tiếp cần xác minh bằng luồng tài khoản bình thường:

1. Payload tương ứng hạng/suất/số lượng hoặc ghế; token nào được website cấp hợp lệ sau queue/xác minh.
2. Response thành công/thất bại, mã giỏ/đơn, hạn giữ và URL checkout chính xác.
3. Cách đọc lại kết quả sau timeout để không gửi lặp giữ vé; cách hủy/khôi phục theo quy tắc website.
4. Một lần thử được kiểm soát tới checkout, đo thời gian và tạo fixture hồi quy từ schema đã lược bỏ dữ liệu cá nhân.

Hiện chưa có các bằng chứng đó. Bản 0.4.0 gọi API trực tiếp cho **dữ liệu**; **đặt vé vẫn qua adapter trên giao diện website**, sử dụng phiên người dùng. Gặp CAPTCHA thì dừng để người dùng xử lý. Không thêm một nhánh POST chưa kiểm tra chỉ để ghi là “API booking”.

## 6. Tốc độ, nguồn tham khảo và cách kiểm tra lại

Catalog dùng GET với timeout 10 giây, allowlist host, `credentials: omit`, không redirect. Cache bộ nhớ tối đa 50 URL: summary 5 giây, các lượt đọc khác 60 giây; gộp request giống nhau đang chờ. Khi bật camp luôn đọc mới detail + summary song song, bỏ cả cache bộ nhớ và HTTP cache. Kiểm tra này diễn ra trước lúc chạy; lựa chọn vé không phải chờ catalog GET trong từng bước.

Nguồn tra cứu mạng chạy ngoài hàng đợi sửa cấu hình/chuyển bước camp. UI dùng số thứ tự request để bỏ kết quả đến muộn. Công cụ không polling tồn kho hoặc retry sau 429.

Đã xem cách [Automa](https://github.com/AutomaApp/automa) tổ chức workflow trình duyệt bằng các bước và điều kiện chờ; tham khảo ý tưởng tách bước/chờ phản hồi, không chép mã. Một [script Ticketbox cũ](https://gist.github.com/actuallyme98/7db61b1e9c75fbca315631e7a69e7e13) dùng route booking khác hiện tại và còn phụ thuộc CAPTCHA; chỉ cho thấy cần kiểm chứng contract theo phiên bản, không dùng làm implementation. Đây không phải bằng chứng mua vé thành công trên nền tảng hiện nay. Nguồn cơ chế browser chính thức nằm trong [review và nguồn](REVIEW_VA_NGUON_THAM_KHAO.md).

```powershell
node scripts/research-platforms.mjs onezone-search ticketbox-search cticket-home
node scripts/probe-catalog.mjs
npm run smoke:catalog
node scripts/research-target.mjs
node scripts/smoke-target.mjs
```

Hai script khảo sát lưu JSON/ảnh cục bộ dưới `artifacts/network-research`; không ghi header/cookie và không lưu bundle JavaScript. Smoke catalog mở extension production, dùng UI gọi API thật, không lưu cấu hình/khởi động camp. Kết quả dưới `artifacts/catalog-live.json`; output không đưa vào Git. Nếu schema đổi, cần cập nhật parser và fixtures, không chỉ sửa kiểu TypeScript.
