# Kiểm tra và chuẩn bị camp Vương Bình Hà Nội · 0.5.4

Hướng dẫn ngắn cho người lần đầu camp, hành vi khi đóng popup/không bấm dừng và giới hạn điện thoại: [CHUAN_BI_18_10.md](CHUAN_BI_18_10.md).

Mục tiêu là vào chọn đúng hạng/số lượng rồi tới checkout sớm nhất trong phạm vi phiên hợp lệ. **Chưa có bằng chứng để cam kết nhanh nhất hoặc chắc chắn mua được.** Kiểm thử cục bộ đo được độ trễ của tool; quyền vào hàng chờ, CAPTCHA, mạng và phản hồi giữ vé của 1Zone vẫn do website quyết định.

## Mốc chạy và thao tác cần thiết

Người dùng đã cung cấp [đúng suất Hà Nội](https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm) và xác nhận **12:00 ngày 18/10/2026, UTC+7** làm mặc định. Đây là mốc người dùng cung cấp, chưa phải thời điểm được xác minh độc lập từ API. Có thể sửa trực tiếp ô giờ trước khi lưu; không lấy giờ diễn 21/11 làm giờ bán.

1. Trong `chrome://extensions`, bấm Reload ở Camp vé rồi **tải lại tab 1Zone**. Mở lại popup và kiểm tra **v0.5.4** ở cả cửa sổ cấu hình lẫn bảng camp trên tab vé. Đăng nhập trước bằng tài khoản dùng để mua. Nếu đang nạp `.output/chrome-mv3` của project thì không cần tải ZIP; file build đã nằm ở đó. Lỗi cũ có thể còn trong danh sách Lỗi của Chrome: Xóa tất cả, tải lại tab rồi kiểm tra có lỗi mới hay không.
2. Trong tiện ích chọn thẻ **TIỆC THÀNH-THÂN (MÂM 2): VƯƠNG BÌNH 💘 VOI CON** có nhãn **Chuẩn bị sự kiện →**. Tool điền link, suất, 12h ngày 18/10, 1 vé, ngân sách trống và tự tải hạng/giá. **Chọn và sắp thứ tự hạng bằng danh sách**, sửa số vé/giờ nếu cần; không gõ lại tên/giá. Tải lỗi thì bấm thử lại; ô nhập thủ công chỉ có khi chủ động bật trong Ngân sách và cách chọn vé. Cập nhật từ bản cũ cần tải lại hạng rồi lưu để bổ sung đủ các khu.
3. Lưu rồi **Bắt đầu camp trước 12h**, để việc tải lại catalog/kiểm tra ban đầu hoàn tất trước giờ bán. Giữ tab và máy hoạt động, đồng hồ máy đúng giờ.
4. Khi website cho mua, tool thao tác trên giao diện đã nhận diện. CAPTCHA/đăng nhập/lỗi không rõ cần xử lý trên website. Đến checkout thì kiểm tra đơn và thanh toán cuối.

Preset chỉ điền bản nháp; không tự lưu/arm, không tự chọn hạng hoặc mở phiên giữ vé.

Gửi bạn bè file `.output/Camp-ve-0.5.4.zip` đã tạo sẵn. Người nhận giải nén, mở `BAT-DAU.html`, nạp thư mục `tien-ich`; không chạy npm. Hướng dẫn ngắn cũng có trong menu tool. Phân phối bằng Web Store và quyền dùng xem [PHAT_HANH.md](PHAT_HANH.md).

Nếu hiện **Cần tải lại tiện ích**, giao diện chưa xác nhận được worker cùng bản. Hãy làm lại bước 1. Bản cũ có thể trả “Lệnh không được hỗ trợ” dù popup đã đọc file mới. Nút Mở rộng ở 0.4.1 dùng link trực tiếp nên vẫn mở trang cấu hình trong trường hợp này; camp được khóa đến khi kiểm tra phiên bản thành công.

Số vé tuân theo giới hạn suất và các hạng đã chọn. Ví dụ dữ liệu hiện có cho TƯ MẾN tối đa 4, HAI QUÝ tối đa 2: chọn riêng TƯ MẾN có thể cấu hình 4; thêm HAI QUÝ làm dự phòng thì tối đa 2 để mọi phương án đều đáp ứng. Giới hạn được lưu khi đóng/mở tiện ích, rồi kiểm tra lại bằng dữ liệu mới khi bật camp. Show khác dùng cùng form tìm/dán link, chọn suất/hạng, số vé và giờ bán; ngày 18/10 chỉ thuộc nút cấu hình nhanh này.

## Cơ chế 1Zone đã đối chiếu

Lần đọc ngày 18/10/2026 dùng profile tạm, không đăng nhập, không giữ vé:

| Bằng chứng | Kết luận |
|---|---|
| Trang event trả HTTP 200, hiện “Sắp mở bán”, CTA disabled | Hiện chưa thể chứng nhận booking thật |
| Vào route booking của đúng suất chuyển về event | Không thể coi link booking công khai là DOM sau đăng nhập |
| Client dùng status OPEN/CLOSE và canPurchase để khóa CTA | Đồng hồ tool tới 12h không tự làm trạng thái website đổi |
| Hero có `data-id="btn-by-ticket"`, cùng trang có CTA sticky | Adapter ưu tiên CTA chính đã biết; các nút mơ hồ vẫn bị chặn |
| SelectTicketModal có tiêu đề “Chọn số lượng vé”, `btn-add`, `btn-sub`, số lượng trong span, `btn-continue` | Đã bổ sung reader/executor cho kiểu modal này, không chỉ input/select/ARIA |
| Client gọi tạo giỏ với hạng/suất/số lượng và dữ liệu xác minh | Tool để website thực hiện request trong phiên; không tự giả token/queue |

Các dấu hiệu modal lấy từ component công khai của website và được tái hiện bằng fixture tối thiểu. **Fixture này chưa phải bản chụp DOM từ tài khoản đã đăng nhập.** Thẻ có tiêu đề p được nhận khi có quote catalog khớp tên/giá và một nút chọn/mua rõ ràng. Map/renderer khác hoặc dữ liệu mơ hồ vẫn cần adapter tương ứng.

## Những thay đổi ảnh hưởng tốc độ

- Camp đang hoạt động dùng microtask để phản ứng với mutation, bỏ khoảng gom 16 ms. Lượt urgent cũng hủy timer theo dõi chậm đang chờ; tránh vô tình giữ nhịp 600 ms khi chuyển sang camp.
- Bắt đầu quyết định/ghi bước trước phần tính highlight và render panel. Vẫn kiểm tra lại sau await và chờ website xác nhận để tránh click sai/lặp.
- Tải catalog/preflight khi bật camp, trước giờ bán; không GET catalog ở từng lần chọn hạng.
- Khi đúng giờ mà đúng trang vẫn NOT_READY, preset cho **reload một lần** trong cửa sổ 15 giây từ mốc bán. Dấu reload được lưu trước hành động và giữ qua điều hướng. Không refresh phòng chờ, CAPTCHA, lựa chọn đang thực hiện hoặc checkout. Không polling/refresh lặp.

Reload một lần là phương án cập nhật trang còn giữ trạng thái cũ; nó có chi phí tải trang và không bảo đảm server mở đúng cùng mili giây. Nếu website cập nhật CTA sẵn, tool dùng nút đang mở ngay và không reload.

## Cách tự thử

**Có giao diện:** Diễn tập → chọn 1 hoặc 2 vé, chọn tình huống → **Chạy thử**. Với phòng chờ, bấm **Cho vào chọn vé** để giả lập website cho vào; với xác minh, chờ tool tạm dừng rồi bấm **Đã xác minh · chạy tiếp**. Kiểm tra Đã tới thanh toán và đúng số vé; **Làm lại** để thử tiếp. Mục kiểm tra nhận diện vẫn có các màn ghế/canvas và trạng thái khác. Không kết nối phiên mua thật, không sửa cấu hình concert.

**Đo nhiều lượt bằng extension production:**

```powershell
npm run build
npm run bench:camp
```

Benchmark dùng Chromium và background/content script thật; website/API là fixture cục bộ, không gửi request tới 1Zone. Mỗi tình huống có một lượt làm nóng rồi 12 lượt đo:

- CTA chỉ mở tại mốc đã đặt, với hai bản CTA trùng; kiểm tra chỉ click bản chính một lần.
- Mô phỏng website phản hồi ngay, hoặc 100 ms ở mỗi bước mở danh sách và checkout.
- Đo **CTA thật sự mở → click mua**, **CTA mở → DOM checkout**, cùng sai lệch timer của website mô phỏng.
- Kiểm tra không bấm trước lúc CTA mở, không chọn hạng khác, không lặp Chọn/Tiếp tục và không bấm thanh toán cuối.

Kết quả p50/p95 và từng mẫu nằm ở `artifacts/camp-benchmark.json`. Các con số phản ánh browser/máy tại lần chạy, **không đại diện tốc độ sale thật, tải server hoặc xác suất mua được**. Một lần “0,1 giây” trên fixture không chứng minh nhanh nhất thị trường.

Lần chạy bản 0.5.4, 24 mẫu đo đều tới checkout đúng luồng, có mapping nhiều khu và modal xác nhận cùng khu:

| Phản hồi website mô phỏng | CTA mở → click mua, p50 / p95 | CTA mở → checkout, p50 / p95 |
|---|---:|---:|
| Ngay lập tức | 6,7 / 33,4 ms | 37,2 / 76,1 ms |
| 100 ms ở mỗi bước mở danh sách và checkout | 8,8 / 33,3 ms | 267,0 / 299,1 ms |

Lượt smoke đọc DOM của 0.4.0 trên trang Hà Nội đo 20 mẫu: p50 12,4 ms, p95 16,9 ms; lượt lạnh đầu tiên 214,4 ms. Đây là chi phí đọc DOM ở lượt cũ, **không phải thời gian đặt vé**. 0.5.0 đã chạy lại smoke catalog bằng API thật, không bật camp hoặc bấm mua.

## Phần vẫn chưa được bảo đảm

Chưa có phiên trình duyệt đã đăng nhập của người dùng được kết nối để kiểm tra giữ vé/checkout thật. Trang hiện còn khóa, nên không gửi đơn thử. Chưa kiểm chứng tài khoản, điều kiện mua, queue token, CAPTCHA sau mở bán, renderer được bật lúc sale và phản hồi lỗi thực tế của suất này. Đã thêm test/đo để phát hiện lỗi của tool; các bước đó không thay thế một lượt kiểm tra hợp lệ trên website thật.

Nguồn: [nghiên cứu API](NGHIEN_CUU_API.md), [cơ chế](CO_CHE_HOAT_DONG.md), [validation](VALIDATION.md). Script `node scripts/research-target.mjs` đọc lại event/booking công khai và lưu bằng chứng dưới `artifacts/target-research`; không click chọn/giữ vé.
