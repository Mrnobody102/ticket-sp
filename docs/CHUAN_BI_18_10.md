# Camp ngày 18/10/2026 · Hà Nội

Đã đính chính theo người dùng: mở bán **12:00 hôm nay, 18/10/2026 UTC+7**. Bản 0.5.2 sửa cấu hình đúng suất còn mang mốc cũ 19/10 khi cập nhật, giữ nguyên hạng/số vé. Sau Reload, kiểm tra giờ trên bảng camp rồi bấm Bắt đầu camp lại; cập nhật không tự bật phiên mua.

Bản 0.5.3 bổ sung chặn tên/ID mâu thuẫn và nhiều khu cùng được chọn. Cập nhật trước giờ bán bằng Reload tiện ích rồi tải lại tab vé, kiểm tra lại 1 vé/ÚT CƯNG/12:00 và bật camp. Gửi bạn bè gói 0.5.3; mỗi người tự đăng nhập và lưu cấu hình của mình.

## Bấm camp rồi không dừng thì sao?

Tool lưu một phiên cho một tab trên Chrome đang dùng. Đóng popup không dừng camp. Trước 12:00, tool chờ giờ đã lưu; sau đó chờ website cho mua, vào chọn hạng/số lượng theo cấu hình và dừng khi nhận diện thanh toán. Không tự bấm thanh toán cuối hoặc mua thêm lượt nữa sau checkout.

Phòng chờ được nhận diện trên 1Zone: chờ website cho vào. Nếu queue trả về trang event thì có thể cần bấm mua tiếp; 0.5.2 đã xử lý bước này. CAPTCHA, đăng nhập, giá/ID mâu thuẫn, điều khiển chưa hỗ trợ hoặc quá hạn xác nhận sẽ tạm dừng. Không tự gửi lại một bước giữ vé chưa rõ kết quả.

Phiên hết hạn sau một giờ tính từ mốc muộn hơn giữa lúc bật và giờ bán. Ví dụ bật hôm nay, giờ bán 12:00 ngày 18/10 thì phiên hết hạn 13:00 ngày 18/10. Đồng hồ máy và việc browser thực thi vẫn quyết định lúc timer được xử lý. Đóng Chrome, đóng tab chủ hoặc Reload extension hủy phiên; mở lại không tự camp. Để máy ngủ hoặc đóng băng tab làm gián đoạn thực thi. Dừng camp không tự hủy chỗ/đơn đã được website giữ.

## Thiết bị và tab

Mở sẵn trang sự kiện hoặc trang chọn vé rồi vào popup Bắt đầu camp được hỗ trợ. Tool tìm tab khớp cả sự kiện và calendarId, xác nhận content script cùng bản rồi dùng lại tab đó; chỉ tạo tab khi chưa có tab khớp. Hai E2E mở website trước cả lúc lưu cấu hình đã kiểm tra đúng tab/suất, không mở trùng, mua/chọn/tiếp tục đúng một lần và không bấm thanh toán cuối.

Nếu bảng đang ghi Đã bật camp, đúng 12:00 ngày 18/10 và đúng hạng/số vé thì giữ phiên đó, không cần dừng hoặc Reload để bắt đầu lại. Sau khi vừa cập nhật extension, tab cũ cần tải lại trước khi bật; handshake sẽ báo nếu tab chưa có bản tương thích. Nên chỉ giữ một tab của suất đang camp để dễ theo dõi.

Dùng Chrome trên máy tính; bản hiện tại được kiểm thử trên Windows/Chromium. Chrome điện thoại không cài extension này, kể cả bật giao diện desktop. [Google xác nhận giới hạn mobile](https://support.google.com/chrome_webstore/answer/1698338?hl=en).

Giữ tab vé ở phía trước, máy cắm điện/không ngủ và mạng ổn định. Không chỉ để Chrome mở rồi chuyển tab cả buổi: browser có thể giảm nhịp timer của tab nền hoặc đóng băng tab. [Giải thích của Chrome](https://developer.chrome.com/blog/timer-throttling-in-chrome-88). Việc ẩn panel khác với đưa cả tab ra nền; ẩn panel vẫn giữ runner hoạt động.

## Các bước cho buổi bán

1. Hôm nay: cài **0.5.3**, Reload extension tại `chrome://extensions` rồi tải lại tab vé. Kiểm tra cùng phiên bản ở cửa sổ cấu hình và bảng camp. Tải lại hạng vé, chọn ưu tiên và lưu lại để có đủ các khu của mỗi hạng. Chạy diễn tập 1 và 2 vé, thử cả phòng chờ/xác minh để hiểu trạng thái và kết quả.
2. Khoảng **11:50–11:55 ngày 18/10**: mở Chrome máy tính, đăng nhập 1Zone, kiểm tra đúng URL Hà Nội `calendarId=8h0YGm`, đúng hạng ưu tiên, số vé và **12:00 ngày 18/10/2026 UTC+7**. 11:00 ngày 21/11 là giờ diễn, không phải giờ bán.
3. Tải lại hạng vé nếu đã chuẩn bị từ hôm trước, chọn thứ tự rồi Lưu. Bắt đầu camp để preflight đọc dữ liệu mới hoàn tất trước 12:00; giữ tab vé ở phía trước. Bật từ hôm trước có thể chờ được nếu browser không gián đoạn, nhưng không thay thế kiểm tra lại đăng nhập/catalog gần giờ bán.
4. Không tự reload/đổi tab/cấu hình trong khi đang queue hoặc đang giữ chỗ. Nếu tool báo cần xác minh/đăng nhập thì xử lý trên website và bắt đầu lại theo trạng thái thực tế của giỏ. Nếu đã có vé/ghế được chọn, kiểm tra giỏ trước khi chạy lại.
5. Tới thanh toán: kiểm tra đúng suất/hạng/số lượng, tổng tiền và hạn giữ của website rồi tự thanh toán. Hạn giữ chỗ trên website là một đồng hồ khác với hạn phiên camp của tool.

## Đã kiểm chứng và còn thiếu

Core dùng trạng thái, chờ bằng chứng DOM thay vì sleep cố định, revision trước click và đọc lại sau await; mỗi website có adapter riêng. Đã kiểm thử API catalog và nhiều luồng tổng hợp. Đây là các nguyên tắc automation có thể đối chiếu với [Automa](https://github.com/AutomaApp/documentation/blob/main/docs/workflow/element-selector.md), [Playwright](https://playwright.dev/docs/actionability), và cách tách nền tảng/ưu tiên của [Tickets Hunter](https://github.com/bouob/tickets_hunter/tree/main/src/platforms). Không chép mã bot hoặc gắn tên công cụ khác làm chứng nhận cho 1Zone.

Chưa có lượt giữ vé/checkout thật bằng tài khoản đăng nhập trên suất này, vì vậy chưa thể cam kết chắc chắn mua được hoặc nhanh nhất. Sơ đồ pixel/canvas/iframe và phòng chờ khác domain chưa có adapter xác minh riêng. Queue-it chỉ được tham khảo về vòng đời chuyển trang/cookie, không phải kết luận 1Zone dùng Queue-it. [Kết quả kiểm thử](VALIDATION.md) phân biệt đo fixture và kiểm tra website thật.
