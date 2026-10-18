# Quyết định triển khai · 0.5.4

Mục tiêu là camp **1 vé mặc định**, tự chọn zone/ghế phù hợp và đi tới checkout nhanh, trên phiên trình duyệt của người dùng. Đã tìm được metadata và hạng vé Vương Bình Hà Nội; người dùng xác nhận 12h ngày 18/10 làm mặc định có thể sửa. Chưa xác minh độc lập giờ bán từ API hoặc DOM booking đăng nhập. TP.HCM và Lavender chỉ dùng tham khảo. Không dùng ước tính 100–200 vé làm tồn kho.

## Các quyết định

1. Giữ một project WXT. Chia core / application / platforms / infrastructure / UI; bản thử không cần backend. Cấp quyền thương mại sau này cần dịch vụ riêng, được kiểm tra trước AUTO_START.
2. Core biểu diễn máy trạng thái và quyết định thuần; không phụ thuộc DOM, React, Chrome.
3. Runner thực thi qua contract và transport; ghi progress trước thao tác, kiểm tra lại sau await, chờ phản hồi thay vì bấm lặp.
4. Background là nơi sở hữu một session camp, khóa tab và revision. Cấu hình bền ở local; phiên camp ở session.
5. Adapter chịu trách nhiệm đọc DOM và thực thi ENTER/CHOOSE/QUANTITY/ADVANCE. Chỉ 1Zone đã có implementation; nền tảng khác chưa được bật.
6. URL policy, tên nền tảng và phạm vi host khai báo trong catalog. Validation, manifest/content matches dùng chung khai báo này.
7. Khi camp, dùng microtask thay cho khoảng gom 16 ms; hủy timer theo dõi chậm khi có việc urgent. Chế độ theo dõi vẫn khoảng 600 ms. Preset cho reload một lần ở mốc bán nếu trang còn khóa, không reload queue/challenge/selection.
8. Nhắc giờ là tính năng phụ. Đến checkout thì kết thúc automation; người dùng kiểm tra đơn và thanh toán cuối.
9. Tách fixtures tĩnh nhận diện và demo booking có tương tác. Demo dùng transport bộ nhớ và cùng runner/core/adapter, không sửa cấu hình/phiên thật.
10. Các lỗi chưa có contract rõ ràng trả PAUSED/UNKNOWN; log trạng thái trên UI, không âm thầm coi click là thành công.
11. Tách `CatalogProvider` (tìm sự kiện/suất/hạng/giá qua GET) khỏi `BrowserPlatformAdapter` (đọc/thao tác booking). Ticketbox có provider mà chưa bật camp.
12. Provider nhận transport từ infrastructure; không tự gọi Chrome, lấy cookie hoặc gửi POST. Parser riêng từng nguồn chuyển schema bên ngoài thành model chung.
13. Cấu hình từ catalog lưu event/performance/ticket ID và giá snapshot. Khi bật camp, đọc mới detail + tickets song song và đối chiếu; trong lúc chọn vé chỉ dùng dữ liệu đã chuẩn bị và DOM hiện tại.
14. Popup gọn, workspace rộng; tìm kiếm theo lệnh người dùng, bỏ response đến muộn. Chặn bắt đầu với thay đổi chưa lưu. Giao diện chỉ nêu khả năng đã triển khai của từng nguồn.
15. Dấu hiệu đặc thù 1Zone đặt trong `onezone-modal.ts` và adapter: hero CTA data-id, stepper span, nút tiếp tục. Quote hỗ trợ thẻ dùng p, vẫn giữ selected/ID đọc được từ DOM. Chưa truy cập React internals/token hoặc gọi API tạo giỏ riêng.
16. Mốc người dùng cung cấp được đưa vào preset rõ ngày, chỉ điền bản nháp. Người dùng chọn/sắp ưu tiên và số vé trước; giới hạn theo suất và các hạng đã chọn được lưu, rồi đọc mới khi arm. Benchmark chạy extension production 24 mẫu; phân biệt độ trễ fixture với nhận diện trang thật và giao dịch thật chưa kiểm chứng.
17. Giao diện/content/worker trao đổi phiên bản khi khởi tạo; lỗi không tương thích hoặc timeout chỉ dẫn Reload. Đây là kiểm tra setup, không thêm request vào từng hành động camp. Link workspace/demo mở trực tiếp, không phụ thuộc command nền.
18. Tên thẻ cấu hình nhanh là tên sự kiện; nhãn thao tác hiển thị riêng. Luồng mặc định tải catalog rồi dùng select; tải lỗi có thể thử lại, không tự đưa người dùng vào textarea. Chế độ thủ công cần bật rõ trong tùy chọn thêm.
19. Khởi tạo content đọc cấu hình và phiên bằng allSettled. Có lỗi thì hiện panel thụ động và hướng dẫn khắc phục; không tạo runner từ trạng thái thiếu dữ liệu. Không bỏ kiểm tra quyền message để che lỗi worker cũ.
20. Hạng/số vé/giờ đặt ở phần chính; thông tin sự kiện không lặp, Lưu/Bắt đầu luôn ở footer. Guide HTML tĩnh trong public mở được cả ngoài extension. Đóng gói production không lấy cấu hình hoặc tài khoản của trình duyệt.
21. `ticket-identity.ts` dùng ID hoặc các tên chính xác do nguồn cung cấp. Alias trùng ID, khác giá hoặc đổi zone trong preflight bị chặn. Canonical label/ID giữ nhất quán giữa card và modal; không để tên zone khác tên hạng phá xác nhận lựa chọn.
22. Semantic reader dùng tên từ ARIA, alt và SVG title; executor hỗ trợ SVGElement thật, không ép kiểu HTMLElement rồi gọi click. Ảnh/canvas không có dữ liệu điều khiển vẫn chưa hỗ trợ.
23. Đổi performance reset ngay giá trị giờ bán/số vé/budget/fallback cũ; lỗi tải hạng không làm lộ cấu hình cũ như cấu hình của suất mới. Reload cùng suất giữ chỉnh sửa giờ của người dùng.
24. Diễn tập có hai luồng tương tác, một nút Chạy thử, Làm lại và số lượng. Fixtures kiểm tra trạng thái đặt riêng; không trộn chúng với bài thử đặt vé. Bộ tạo dữ liệu tách khỏi React entrypoint.
25. Gói bạn bè có BAT-DAU.html và tien-ich; gói Store giữ manifest ở gốc. Workflow chạy kiểm tra rồi tạo artifact, không tự publish. Chưa có server nên không thêm khóa key cục bộ giả; quyết định triển khai cấp quyền ghi trong PHAT_HANH.md.
26. Queue chỉ reset OPENING → READY để xử lý admission trả về event; không reset một ADVANCING chưa xác nhận. START/STOP có control revision và chống response/broadcast cũ; lệnh dừng hủy hành động local trước khi chờ worker.
27. Kiểm tra vòng đời MV3 bằng CDP ServiceWorker.stopWorker, xác nhận worker dừng rồi detach debugger trước khi đợi browser tự đánh thức. Target.closeTarget không mô phỏng chính xác worker suspension. Kiểm tra đóng popup, giữ nguyên ID phiên và tự hết hạn bằng bài riêng.
28. verify-output.mjs kiểm tra gói đã build: MV3/version, resource ở trong extension, cú pháp JS và không có script HTML inline/remote hoặc file phát triển. Kiểm tra này là điều kiện đóng gói bản chia sẻ; không thay thế xét duyệt Web Store.
29. Khi bật từ popup, CONTENT_READY kiểm tra bản content script trên frame chính trước khi tạo phiên. Chờ tối đa khoảng 8 giây cho tab mới; listener treo bị timeout. Listener đăng ký sau handshake worker nhưng trước AUTO_GET để không khóa chéo với hàng đợi AUTO_START.
30. Với seatmap_zone, ghép endpoint zones theo ticketClassId, xác minh event/calendar/ID/tên và lưu cả tập khu. Không coi zoneName summary là toàn bộ khu. Card/modal giữ tên khu cụ thể; một hạng chưa chọn khu có thể chuyển tới khu thuộc tập đã xác minh.
31. Diễn tập giữ ba tình huống tương tác dùng cùng runner/adapter: bình thường, queue, xác minh. Website và transport vẫn là local; không sửa cấu hình/session thật hoặc dùng kết quả làm chứng nhận giữ vé.
32. 0.5.2 đính chính giờ bán thành 12:00 ngày 18/10/2026 UTC+7 theo thông tin mới của người dùng. Migration chỉ chạy khi cài/cập nhật: đúng URL/suất Hà Nội và đúng timestamp cũ 19/10 thì sửa ngày, giữ các lựa chọn, dừng phiên trước khi lưu và không tự bật camp. Không sửa giờ tùy chỉnh khác hoặc sự kiện khác; không thêm kiểm tra vào mỗi bước chọn vé.
33. 0.5.3 xác minh đồng thời nhãn hạng/khu và class ID trước canonical hóa; nhãn ghế riêng vẫn dùng class ID với zone cha nếu có. Modal phải khớp class/zone ID nếu xuất hiện. Có dấu hiệu modal nhưng không xác minh được thì báo problem để không rơi xuống generic advance. Nhiều selected sau một lần chọn dừng trước quantity/checkout. Không thêm network I/O hoặc timer vào đường thực thi.
34. 0.5.4 giữ so sánh state nội bộ chính xác, siết classifier checkout từ substring thành tiêu đề chuẩn hóa đã hỗ trợ kèm bằng chứng form/nút. Không coi FAQ nhắc thanh toán là checkout. UI phân biệt Chưa mở bán / Đang camp, bỏ lặp câu chờ, gom thao tác phụ và bỏ nút tắt trùng khi camp đang chạy.

## Phạm vi bàn giao

| Hạng mục | Có | Cần xác minh tiếp |
|---|---|---|
| Zone/ghế tự cấp | Tự chọn, đọc selected, đặt số lượng, đi tiếp trên fixture | DOM sự kiện thật và cách website xác nhận giữ vé |
| Ghế cụ thể | Một ghế có nhãn/giá đọc được cho 1 vé | Map thật; chưa nhóm ghế liền nhau |
| Phòng chờ | Chờ trạng thái, tiếp tục trên tab chủ khi được vào | Queue/host/session của sale mục tiêu |
| Phiên và dừng | Khóa tab, CAS, hủy khi đổi cấu hình/dừng/đóng tab | Diễn tập trên Chrome cá nhân |
| Tìm và chọn hạng | 1Zone API/metadata; Ticketbox search/detail | Endpoint không có cam kết schema; tồn kho phải được website xác nhận |
| Nền tảng khác | Contract dùng chung; Ticketbox có provider tra cứu | Booking adapter riêng; CTicket chưa đọc qua màn xác minh |
| Tốc độ | Đo trong E2E fixture và hiển thị số đo phiên | Không suy rộng thành SLA trên mạng/server thật |

Quyền host API chỉ phục vụ GET catalog. Content script vẫn chỉ ở 1Zone. Không có nhánh API tạo giỏ/đơn được công bố là đã hoạt động; xem [nghiên cứu từng nền tảng](NGHIEN_CUU_API.md).

Xem [cơ chế kỹ thuật](CO_CHE_HOAT_DONG.md), [kết quả thực thi](VALIDATION.md) và [nguồn đối chiếu](REVIEW_VA_NGUON_THAM_KHAO.md).
