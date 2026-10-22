# Rủi ro hệ thống và tiêu chí vận hành · 0.6.3

Thước đo là **vào mua sớm, chọn đúng vé, tới checkout và không gửi lặp giữ chỗ**. Một lỗi có thể phục hồi mà app chỉ hiện thông báo rồi bỏ lượt vẫn là lỗi chưa xử lý xong.

## Tiêu chí nghiệm thu

1. Bật camp trước giờ bán: runner, tab và phiên đã hoạt động trước mốc tranh vé. Chế độ theo web bắt đầu ngay khi CTA đã được xác minh mở, kể cả trước giờ dự kiến.
2. Trang giữ trạng thái cũ: app tự tải mới trước và sau giờ bán; không đợi người dùng F5. Không refresh queue, lựa chọn hoặc yêu cầu giữ chỗ đang xử lý.
3. Sau admission: app tự nhận lại đúng phiên, chọn theo ID/hạng/giá, xác nhận số lượng và đi qua bước mua kèm đã kiểm chứng tới checkout.
4. Sự cố có thể thử lại an toàn: tự phục hồi. Không biến timeout mạng thành lý do gửi lại một yêu cầu giữ chỗ chưa rõ kết quả.
5. Mỗi lượt thử phải ghi nhận thời gian mở bán → vào queue, thời gian tới checkout, vé thực tế, số lần giữ vé và kết quả. Không lấy tốc độ của riêng hàm quyết định để đại diện toàn quy trình.

## Lỗi hệ thống và cách app xử lý

| Lỗi ảnh hưởng lượt camp | Phát hiện và phục hồi tự động | Bằng chứng kiểm thử |
|---|---|---|
| Khởi tạo muộn vì đợi tài nguyên | Content script chạy ở `document_end`; bắt đầu đọc DOM khi ảnh vẫn chưa tải xong | E2E giữ ảnh ở trạng thái pending nhưng app vẫn bấm mua và tới checkout |
| Trang event cũ, mở bán sớm/trễ | Quan sát DOM; tải mới NOT_READY từ 2 phút trước giờ hẹn, mỗi giây trong phút cuối khi tài liệu đã tải xong; CTA khả dụng được ưu tiên hơn tiêu đề cũ | E2E nhiều phản hồi cũ, mở sớm/trễ; benchmark SSR → F5 → queue → checkout |
| Nhịp F5 lệch mốc bán / ảnh kẹt giữ luồng cập nhật | Mốc bán có ưu tiên hơn khoảng cách refresh định kỳ; phân biệt script khởi tạo với media, không chờ ảnh rồi mới refresh | Unit F5 trước mốc 50 ms vẫn kiểm tra đúng mốc; E2E ảnh pending nhưng vẫn tự tải mới và mua |
| F5 cắt ngang lúc website vừa chuyển bước | Đọc lại sau khi ghi bước, hủy refresh khi đã vào queue/chọn vé/checkout | Unit runner thay đổi trạng thái trong lúc ghi bước |
| CTA điều hướng chưa nhận click | Chỉ retry CTA vào booking đã xác minh, có giãn cách và giới hạn; phục hồi event nếu vẫn kẹt | E2E CTA chưa gắn xử lý rồi hoạt động; không áp dụng retry này cho giữ vé |
| Đứt luồng khi sang `queue.1zone.vn` hoặc khi được trả về event | Đối chiếu đích/suất, giữ chủ phiên qua điều hướng; website cho vào thì tự chọn tiếp | E2E queue dài, xác minh, trả về booking/event, tab mở tay |
| Tab bị Chrome tự bỏ hoặc máy tự ngủ do để lâu | App dùng `power` giữ hệ thống hoạt động, tạm đặt `autoDiscardable=false`; chuẩn bị tab trước mốc bán; có alarm kiểm tra vòng đời riêng | Unit chính sách bảo vệ; E2E Chrome thật discard/restore. Không thay cài đặt nguồn điện lâu dài |
| Chrome thay ID khi khôi phục tab | Bắt `tabs.onReplaced`, chuyển quyền sang ID mới, giữ ID phiên/tiến trình/dấu giữ vé, tăng revision; tab cũ không còn quyền ghi bước | Unit ownership và E2E discard thật đã tái hiện việc đổi ID |
| Worker ngắt, popup đóng, thông báo phiên bị lỡ | Tiến trình ở session storage; content lấy lại phiên, guard nhắc đúng chủ bằng cùng phiên, không tạo lượt mua mới | E2E ngắt worker và đóng popup; kiểm tra revision chống bước cũ |
| Sơ đồ tải chậm hoặc khu đổi trạng thái không đổi DOM | Với Konva đã biết, chờ và đọc lại; redraw đánh thức runner, không F5 trang chọn vé | E2E tải chậm quá 15 giây và redraw không đổi DOM |
| Khu hết đúng lúc chọn hoặc vé được trả lại | Chỉ retry khi adapter chứng minh chưa gửi giữ chỗ; giữ điều kiện hạng/giá, nghỉ 1 giây sau mỗi 5 lần tranh chấp rồi tiếp tục | E2E khóa giữa kiểm tra/click, trước modal, hơn 5 lần liên tiếp và vé trở lại |
| Nhầm khu, sai giá/số lượng, nhiều tab mua cùng lúc | Đối chiếu catalog và modal, kiểm tra lại DOM trước click, một tab sở hữu phiên; không lấy số lượng yêu cầu làm bằng chứng số lượng thực tế | Unit ID/alias/giá; E2E nhiều khu cùng hạng, modal sai, 1–2 vé, nhiều tab |
| Phản hồi giữ vé đến muộn | Ghi dấu trước click, không gửi lại; tiếp tục quan sát checkout sau timeout và khi ẩn panel; khóa START/SAVE làm mất dấu cũ | E2E kết quả tới muộn: cùng phiên, 1 lần giữ vé, không bấm thanh toán cuối |
| Bước mua kèm chen giữa giữ vé và checkout | Chỉ tự tiếp tục khi khớp vé và tổng tiền; không chọn thêm sản phẩm | E2E tổng đúng tự đi tiếp, tổng sai không đặt thêm |
| Bảo vệ tab/chống ngủ còn bật sau khi dừng | Guard riêng trả lại chính sách tab gốc và thả chống ngủ khi Dừng, lưu cấu hình, checkout, hết phiên hoặc đóng chủ; chuyển tab trả lại tab cũ | Unit trả cờ gốc, hết hạn, thay ID; E2E Dừng sau restore |

Guard chạy ngoài hàng đợi ghi bước camp và không gọi API tồn kho. Alarm chỉ bảo vệ vòng đời, **không dùng làm cò bấm mua**. Khi đang camp, DOM/redraw đánh thức runner ở microtask tiếp theo; quyết định chạy trước vẽ panel. Ghi bước và xác minh lại điều khiển vẫn bắt buộc để không đổi tốc độ lấy vé sai/lặp đơn.

## Đo hiệu quả toàn luồng

- [Benchmark entry](../tests/benchmark/entry.spec.ts): trang SSR còn khóa → tự F5 → CTA mua → queue → đúng VIP × 2 → checkout. Fixture cố định phản hồi 50 ms và queue 200 ms; ngân sách nghiệm thu vào queue dưới 1.500 ms từ lúc server mô phỏng mở, checkout dưới 2.200 ms. Vượt ngân sách hoặc giữ vé khác 1 lần là test thất bại.
- [Benchmark DOM](../tests/benchmark/camp.spec.ts) và [Konva](../tests/benchmark/map.spec.ts): đo p50/p95 từ lúc giao diện mở, kiểm tra đúng lựa chọn và không click lặp.
- [E2E vận hành](../tests/e2e/operations.spec.ts): tải tài nguyên kẹt, Chrome thay tab ID, chuẩn bị foreground và trả lại chính sách sau Dừng.

Số mẫu và kết quả build cuối nằm trong [VALIDATION.md](VALIDATION.md). Các số trên là phép thử kiểm soát được, không phải thời gian hoặc tỷ lệ mua vé của website thật. Chưa có bằng chứng checkout thật đã đăng nhập cho đợt bán tiếp theo.

## Khoảng trống kỹ thuật còn mở

Các trường hợp dưới đây vẫn là phần chưa hoàn thiện, không được tính thành đã xử lý chỉ vì có thông báo lỗi:

- Chưa có API đối soát yêu cầu giữ chỗ/đơn để kết luận một timeout đã thất bại hay thành công. Hiện app không gửi lặp và tiếp tục nhận kết quả đến muộn; chưa tự khôi phục được mọi trường hợp kết quả mất hẳn.
- Chưa có phục hồi đầy đủ cho trang lỗi mạng Chrome, HTTP 429/5xx hoặc phiên đăng nhập hết hạn. Không tự giải CAPTCHA hay vượt admission do website kiểm soát.
- Chưa có adapter cho mọi renderer; ảnh thuần, cấu trúc sơ đồ mới và nhóm nhiều ghế/liền nhau chưa đủ cơ chế xác minh để tự mua chính xác.
- Session không khôi phục lượt camp sau khi đóng hẳn Chrome/cập nhật extension. Chưa có đối soát đơn để khởi động lại an toàn qua các ranh giới này.

## Nguồn kỹ thuật

- [Chrome power](https://developer.chrome.com/docs/extensions/reference/api/power): giữ hệ thống không ngủ do không hoạt động trong thời gian extension yêu cầu.
- [Chrome tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs): `autoDiscardable`, phục hồi tab và sự kiện `onReplaced`.
- [Content script run time](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#run_time): chọn thời điểm khởi tạo theo DOM.
- [Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms): lưu phiên ngoài biến toàn cục; alarm không thay thế luồng DOM và không đánh thức máy đã ngủ.
- [Queue-it cookie/session](https://queue-it.com/cookie-statement-user/): cơ chế phiên của nhà cung cấp; không suy ra quyền nhảy hàng hoặc thứ tự admission của một sale 1Zone.
