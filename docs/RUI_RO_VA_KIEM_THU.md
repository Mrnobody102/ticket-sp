# Rủi ro khi camp vé · 22/10/2026

Mục tiêu của bản 0.6.2: đi tới checkout đúng suất, đúng hạng và số lượng đã lưu; phục hồi các bước có thể thử lại an toàn. Checkout là màn hình được adapter nhận diện, chưa phải bằng chứng server đã giữ vé. Người dùng kiểm tra đơn, thời hạn và thanh toán.

## Các điểm vừa sửa

- Sơ đồ Konva đã nhận diện nhưng tải chậm: tiếp tục chờ và đọc lại, không dừng nhầm sau 15 giây hoặc F5 trang chọn vé.
- Khu vừa hết vé trước khi gửi giữ chỗ: thử lại theo ưu tiên; sau mỗi 5 lần tranh chấp, nghỉ 1 giây rồi đọc mới. Không áp dụng retry này cho yêu cầu giữ vé.
- Đã chuẩn bị gửi giữ vé nhưng chưa rõ kết quả: khóa bắt đầu/lưu cấu hình mới; tiếp tục nhận checkout đến muộn, kể cả khi ẩn panel. Nút trong popup chuyển thành **Kiểm tra tab vé**.
- Khi mạng trở lại hoặc trang được hiển thị lại: kích hoạt đọc giao diện ngay. Việc này không xác nhận đơn trên server và không khôi phục phiên đã bị xóa.

## Ma trận kiểm tra

| Bước / rủi ro | Cách xử lý hiện tại | Kiểm chứng / phần còn lại |
|---|---|---|
| Sai ngày, nhầm giờ diễn với giờ bán | Giờ bán riêng, hiển thị UTC+7; không tự dùng lại lịch đã qua trong preset | Unit chuyển múi giờ, E2E cập nhật phiên bản. Lịch đợt bán mới cần nhập theo thông báo chính thức |
| Web mở sớm hoặc trễ | Chế độ theo web dùng CTA đã xác minh; trước giờ bán có tải mới trạng thái khóa, sau giờ vẫn chờ | E2E mở sớm, mở trễ, nhiều phản hồi cũ. Chế độ **Chỉ đúng giờ đã đặt** vẫn tuân theo giờ đã đặt |
| Trang cũ không tự đổi trạng thái | F5 trang đúng sự kiện đang khóa từ 2 phút trước mốc bán; phút cuối mỗi giây nếu trang đã tải xong, giảm nhịp khi bán trễ | Unit lịch refresh, E2E nhiều lần reload. Không F5 queue/chọn vé/giữ chỗ; giới hạn tốc độ của server vẫn có thể chặn |
| Reload chen vào lúc vừa mở hoặc chuyển bước | Kiểm tra lại trước thực thi; bỏ reload nếu đã vào chọn vé, queue hoặc checkout | E2E CTA còn tiêu đề cũ; unit runner thay đổi giao diện giữa lúc ghi bước |
| Bấm mua trước khi website gắn sự kiện | Chỉ thử lại CTA điều hướng đã xác minh, tối đa 3 lần cách 1,5 giây; có thể tải mới đúng trang event nếu vẫn kẹt | E2E CTA chưa phản hồi. Không áp dụng cho nút giữ vé/thanh toán |
| Hàng chờ ở miền riêng | Nhận đúng `queue.1zone.vn` và đích của suất đã lưu; giữ tab, chờ chuyển lại booking hoặc event rồi tiếp tục | E2E queue dài, có xác minh, trả về event, chuyển quyền sang tab mở tay. Không nhảy hàng, sao chép token hoặc F5 queue |
| Đăng nhập hết hạn / CAPTCHA | Đăng nhập trước. Xác minh tại queue/modal đã biết giữ phiên để tiếp tục khi website cho phép; trang đăng nhập/xác minh khác yêu cầu xử lý trực tiếp | E2E CAPTCHA/modal khóa nút. Không tự giải xác minh; cần kiểm tra tài khoản trước giờ bán |
| Sơ đồ tải chậm | Với renderer đã biết, đọc lại mỗi giây và khi có thay đổi; không coi chậm hơn 15 giây là không hỗ trợ | E2E chậm hơn 15 giây rồi render thành công; vẫn chịu giới hạn thời gian phiên |
| Tên khu là ảnh, SVG, canvas | DOM có nhãn/giá, SVG có ngữ nghĩa; Konva đọc dữ liệu khu, class và giá rồi đối chiếu modal | Unit ảnh/alt/SVG; E2E Konva thật. Ảnh thuần hoặc renderer mới không có dữ liệu xác minh chưa tự chọn được; không đoán bằng màu/tọa độ |
| Đổi tên khu, trùng tên, sai suất hoặc giá | Đối chiếu ID, alias cùng bản ghi catalog, giá, suất; kiểm tra lại modal và số lượng | Unit xếp hạng/URL; E2E giá đổi, nhầm khu, modal sai. Website đổi schema/renderer cần adapter và test mới |
| Catalog cũ hoặc giới hạn số vé đổi | Preflight GET khi bật camp, kiểm tra tiếp số lượng/giá trên giao diện trước thao tác | Unit preflight và quantity; E2E 1–2 vé. Bật camp sớm để việc tải catalog nằm ngoài thời điểm tranh vé |
| Khu hết rồi có vé trả lại | Giữ camp, đọc lại trạng thái sơ đồ; không tự đổi sang hạng ngoài cấu hình | E2E hạng ưu tiên hết trong khi hạng khác còn, redraw không đổi DOM, vé trở lại. Không tạo vé khi tồn kho bằng 0 |
| Khu hết đúng lúc bấm | Chỉ retry khi adapter xác minh chưa gửi giữ chỗ, giữ nguyên điều kiện giá/hạng | E2E khóa giữa kiểm tra và click, trước modal và hơn 5 lần liên tiếp; nghỉ ngắn để tránh vòng lặp nóng |
| Chọn ghế thay vì chọn khu | Một ghế DOM/SVG có nhãn/giá đã hỗ trợ cho 1 vé; chọn khu và số lượng là luồng riêng | E2E ghế DOM/SVG. Chưa tự ghép nhiều ghế/liền nhau hoặc suy ra ghế từ ảnh; không được coi mọi show đều tương thích |
| Hai tab thao tác / thao tác cũ sau Dừng | Một tab sở hữu phiên; kiểm tra ID phiên, revision và cấu hình trước mỗi bước; chuyển tab chỉ trước chọn/giữ vé | Unit CAS/runner, E2E nhiều tab, Dừng và ẩn panel. Ẩn panel không dừng camp |
| Worker Chrome tắt / đóng popup | Phiên trong `storage.session`, cấu hình và bản nháp trong local storage; worker chạy lại lấy phiên đang có | E2E ngắt worker, đóng popup. Đóng browser, reload/cập nhật extension hoặc đóng tab chủ sẽ kết thúc phiên |
| Giữ vé phản hồi chậm, mất mạng sau click | Ghi dấu trước khi bấm; không gửi lại vì timeout. Sau tạm dừng vẫn nhận checkout đến muộn; chặn bắt đầu/lưu để không xóa dấu cũ | Unit và E2E kết quả muộn, ẩn panel, chặn yêu cầu mới. Dấu này ghi ý định thao tác, không chứng minh server đã nhận; kiểm tra đơn trên website |
| Dừng rồi chạy lại sau giữ vé | Dừng chỉ dừng công cụ, không hủy chỗ/đơn trên website | Dừng hoặc browser restart có thể xóa dấu phiên; phải kiểm tra đơn đang giữ trước khi chạy lại. Chưa có API đối soát đơn để tự xác nhận |
| Bước mua kèm / thanh toán | Chỉ bỏ qua mua kèm khi đối chiếu được vé và tổng tiền; dừng ở checkout, không bấm thanh toán cuối | E2E tổng tiền đúng/sai, đếm click giữ vé đúng 1 lần. Form bắt buộc, thanh toán ngoài host và đồng hồ giữ chỗ chưa được hỗ trợ đầy đủ |
| Mất mạng, 429, 5xx hoặc trang lỗi Chrome | Đọc lại khi online; không tự lặp POST giữ vé hoặc tăng tải polling API | Chưa có tự phục hồi đầy đủ cho trang lỗi mạng/429. Kiểm tra đơn trước thao tác lại; không đổi mạng trong hàng chờ |
| Tab nền, Memory Saver, máy ngủ, đồng hồ lệch | Luồng chính theo DOM/redraw; timer dự phòng. Giữ tab trước, máy thức, bật đồng bộ giờ và ngoại lệ Memory Saver | E2E worker không mô phỏng hết cơ chế tiết kiệm điện thực. JS không chạy khi máy ngủ/tab bị đóng băng; không thể cam kết tốc độ trong tình trạng đó |
| Back/Forward hoặc tab bị Chrome tải bỏ | Lắng nghe `pageshow`, đọc lại giao diện; kiểm tra revision trước hành động | Trang khôi phục từ cache vẫn có thể cũ. Không Back/F5 trong giữ chỗ; chưa có đối soát server tự động sau khôi phục |
| Nạp nhầm output / script phiên bản cũ | Kiểm tra version UI/worker, MV3 và hash từng file trong hai ZIP; diễn tập từ ZIP đã giải nén | E2E runtime cũ/mới. Reload extension và tab trước sale, không cập nhật giữa hàng chờ/giữ vé |
| Rò dữ liệu trong báo cáo / bản chia sẻ | Báo cáo có dữ liệu cho phép và URL đã lọc; không xuất cookie/token/form/HTML | Unit báo cáo/URL; kiểm tra file ZIP production. Người nhận tự đăng nhập, không gửi profile hoặc link queue có token |

Các bài tự động nằm trong [unit](../tests/unit), [E2E extension](../tests/e2e/extension.spec.ts), [E2E sơ đồ](../tests/e2e/onezone-map.spec.ts), [E2E runtime](../tests/e2e/runtime.spec.ts). Số bài và đo tốc độ của build cuối ghi ở [VALIDATION.md](VALIDATION.md). Luồng giữ vé dùng dữ liệu mô phỏng, không thay thế kiểm chứng checkout đã đăng nhập trên website thật.

## Tốc độ và giới hạn thiết kế

Khi đang camp, thay đổi DOM/redraw đánh thức runner ở microtask tiếp theo; quyết định chạy trước vẽ panel. Ghi bước trước click và kiểm tra lại điều khiển để tránh sai vé/lặp giữ chỗ. Các kiểm tra này vẫn nằm trên đường thao tác; không thêm request catalog cho từng click. Khoảng nghỉ 1 giây chỉ xuất hiện sau 5 lần chọn thất bại đã được xác minh an toàn.

API công khai dùng để tra cứu sự kiện/suất/hạng/giá; chưa có API giữ chỗ được xác minh để thay thế luồng website. Không gọi thử endpoint mua, gửi lại token hay vượt queue/CAPTCHA. Một request giữ vé chưa rõ kết quả không thể vừa được lặp vô điều kiện để nhanh hơn vừa bảo đảm không đặt trùng.

## Nguồn đối chiếu

- Chrome có thể dừng service worker sau thời gian không hoạt động; trạng thái quan trọng cần lưu ngoài biến toàn cục: [vòng đời service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
- `storage.session` mất khi browser đóng hoặc extension bị reload/cập nhật/vô hiệu hóa: [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage). Alarm không đánh thức máy đang ngủ: [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms).
- Timer tab nền bị giới hạn: [Chrome timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88). Cài ngoại lệ trang luôn hoạt động: [Chrome Memory Saver](https://support.google.com/chrome/answer/12929150?hl=en).
- Trang Back/Forward có thể phục hồi cả heap JS và DOM cũ; `pageshow` báo lần phục hồi: [back/forward cache](https://web.dev/articles/bfcache).
- Queue-it dùng cookie để quản lý phiên hàng chờ/đã được cho vào: [cookie của người dùng](https://queue-it.com/cookie-statement-user/). Đây là tài liệu cơ chế nhà cung cấp, không phải cam kết cách xếp thứ tự của từng sale 1Zone.

Giờ/link đợt Vương Bình tiếp theo chưa được cung cấp. Chưa dùng dữ liệu tồn kho ngày 18/10 để khẳng định còn vé ở thời điểm hiện tại.
