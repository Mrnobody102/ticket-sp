# Rà soát source và cơ chế tham khảo · 0.5.0

## Review 0.5.0

| Phát hiện | Sửa và kiểm chứng |
|---|---|
| API có name khác zoneName; booking ưu tiên zoneName | Lưu alias cùng ID/giá, canonical hóa option/card/modal, preflight chặn alias đổi; unit và E2E qua modal 2 vé |
| SVGElement không có HTMLElement.click; ảnh/ARIA-only từng bị bỏ qua | Đọc nhãn semantic và giá, thực thi click SVG; E2E một ghế SVG tới checkout, unit ảnh/ARIA/disabled/ID sai/alias trùng |
| Giờ bán của suất cũ có thể theo sang suất mới | Reset trước lúc tải dữ liệu; E2E đổi Hà Nội/TP.HCM xác nhận giờ rỗng và 1 vé |
| Demo ban đầu mở fixture tĩnh, chờ 3 phút và có quá nhiều nút kỹ thuật | Mặc định luồng tương tác, 1–2 vé, Chạy thử/Làm lại; fixtures kỹ thuật thu gọn, không bật automation |
| Lỗi quyền từ worker/tab cũ khó phân biệt, người dùng vẫn thấy Uncaught ở bản đang nạp | Handshake cả content, version trên panel, bắt lỗi bootstrap đồng bộ và bất đồng bộ; lỗi lúc bấm Start được bắt riêng. Test không có pageerror/click vé. Không thể sửa code đã nạp trong tab cũ bằng việc chỉ ghi file trên đĩa |
| Tài liệu bắt đầu bằng lệnh build làm người nhận tưởng phải chạy source | README ưu tiên gói dùng ngay; ZIP bạn bè có hướng dẫn tại gốc và folder extension riêng; artifact Store/checksum tách riêng |

Chưa xác nhận DOM booking đăng nhập, CAPTCHA, hợp đồng giữ vé và timeout của API POST trên suất Hà Nội. Không coi các ca fixture là bằng chứng đặt vé thật. Không có backend cấp quyền trong 0.5.0; phương án triển khai và giới hạn bảo vệ ghi ở [PHAT_HANH.md](PHAT_HANH.md).

Bản 0.1.0 chỉ nhắc giờ và đánh dấu vé, chưa đủ cho yêu cầu camp theo tốc độ. Bản 0.2.0 thêm executor theo trạng thái, dùng chung core/runner cho các nền tảng. Chức năng trên sự kiện thật vẫn cần xác minh từ DOM/luồng của sự kiện đó.

## Ranh giới code

| Thành phần | Vai trò | Thay đổi khi thêm nền tảng |
|---|---|---|
| core/models.ts, preferences.ts, workflow.ts | Dữ liệu, URL/giờ, điều kiện và ưu tiên | Giữ nguyên logic chung |
| core/platform-catalog.ts | URL policy và tên nền tảng, không có DOM | Khai báo integration đã xác minh |
| core/automation.ts | Quyết định, trạng thái, validation progress | Mở rộng khi có nhu cầu nghiệp vụ mới |
| application/automation-runner.ts | Serialize thao tác, persist, kiểm tra lại, hẹn giờ | Dùng lại |
| platforms/contracts.ts, registry.ts | Contract đọc/thực thi, chọn adapter | Đăng ký adapter mới |
| platforms/onezone-*.ts | Nhãn, giá, selected, nút/quantity của 1Zone | Viết phần riêng cho website mới |
| infrastructure/automation-*.ts | Chrome session, tab owner, revision, messages | Dùng lại |
| ui và entrypoints | Cấu hình, quan sát trang và trạng thái | Content matches lấy từ catalog |

Nguồn catalog 1Zone/Ticketbox là hai provider thật, dùng schema GET đã quan sát và transport được truyền vào; tests dùng dữ liệu tổng hợp tối thiểu. Ticketbox chưa có booking adapter, CTicket chưa kết nối. Contract nguồn dữ liệu và contract thao tác website độc lập: thêm tra cứu không đồng nghĩa đã đặt vé được.

## Những điểm được sửa/kiểm tra

- Một ghế là một vé; không nhân giá một ghế như nhóm N vé. Ghế/khu có selected bị loại khỏi gợi ý nhưng vẫn được dùng để xác nhận hành động đang thực hiện.
- Ưu tiên tên chính xác sau normalize, phân biệt VIP/VVIP và các hậu tố. Giữ đúng calendarId giữa event/booking.
- Không coi thẻ giới thiệu/Xem tất cả là lựa chọn có thể mua; parse cả giá tiền tố/hậu tố.
- Không gộp nhóm ghế cùng giá có tiêu đề thành zone; bindings và snapshot cùng lượt đọc.
- Chưa mở bán, phòng chờ, CAPTCHA, checkout và lỗi giữ chỗ được xét trước hành động chọn.
- Link booking sang suất khác bị loại cả ở ENTER và ADVANCE; điều khiển ẩn/disabled không được dùng.
- Chỉ đi tiếp sau khi đọc được selected và số lượng chính xác; không bấm nút thanh toán cuối.
- Ghi session theo ID/revision trước thao tác. Lệnh lặp/cũ, tab khác, iframe, progress hỏng và nhảy bước không hợp lệ bị từ chối.
- Sau await, đọc lại DOM và quyết định; tests trì hoãn persist để kiểm tra STOP/đổi DOM không gây click cũ.
- Ẩn panel vẫn chạy phiên camp; đổi cấu hình/dừng/đóng tab hủy phiên. Reload Chrome không tự chạy phiên cũ.
- Catalog giữ event/performance/ticket ID và giá; chặn ID trùng, giá mơ hồ, link ngoài nguồn, sai suất/ngày/địa điểm, currency và giới hạn số lượng.
- Khi bật camp đọc mới dữ liệu, không tin cache tra cứu. Các GET tìm kiếm chạy riêng, không chặn chuyển bước automation.
- UI bỏ kết quả đến muộn, chặn chạy form chưa lưu; popup và workspace dùng cùng component. Trạng thái người dùng được viết bằng tiếng Việt; phase kỹ thuật giữ ở session/data attribute để chẩn đoán.
- Đối chiếu CTA chính `btn-by-ticket` và modal public của 1Zone; reader riêng cho `btn-add/sub/continue`, số lượng span và giá gốc gạch ngang. Fixture mô phỏng theo component chưa thay thế DOM booking đăng nhập thật.
- Quote bổ sung từng làm mất selected của thẻ ARIA trong một lượt test hồi quy: đã giữ bằng chứng từ semantic reader và thêm test để ngăn tái diễn.
- Camp dùng microtask ưu tiên; reload một lần chỉ khi trang còn khóa tại giờ bán, dấu được giữ qua điều hướng. Có kiểm tra không reload queue/challenge/checkout.
- Preset chỉ điền bản nháp; người dùng chuẩn bị thứ tự hạng, số vé và giờ từ trước. Giới hạn suất/hạng được lưu và kiểm tra lại trước khi arm.
- Benchmark 24 mẫu qua extension production đo từ CTA mở đến click/checkout mô phỏng, kiểm tra không click sớm/lặp/final-payment. Smoke target thật chỉ đọc DOM; không dùng benchmark này để cam kết tốc độ sale.
- 0.4.1 xử lý phản hồi lỗi thực tế: bỏ chữ “Dùng” khỏi tên sự kiện, chuyển thao tác sang nhãn riêng. Khi catalog chưa tải được, mặc định cho tải/thử lại thay vì hiện textarea. Smoke API thật chọn được HAI QUÝ qua select và đọc max=2, chỉ trong bản nháp.
- Bộ test trước chỉ nạp extension đồng bộ và mở thẳng workspace, chưa thử nút Mở rộng hoặc UI mới đi cùng worker cũ. Đã thêm E2E cho hai trường hợp, cùng ca API lỗi rồi tải lại. Handshake build/protocol và lỗi mất kết nối dùng chung module; link mở trang không phụ thuộc worker.
- 0.4.2 xử lý lỗi content `AUTO_GET` bị worker cũ từ chối. Khởi tạo lỗi vẫn hiện panel thụ động, không có Uncaught và không tự camp. Giữ nguyên chặn SAVE từ content; background bỏ qua loại message không thuộc hợp đồng.
- UI chỉ hiện thông tin sự kiện một lần; chọn select tự thêm ưu tiên, Lưu/Bắt đầu cố định. Guide HTML tĩnh đi cùng ZIP và mở được trong tool; gói chia sẻ chỉ đổi tên bản ZIP production đã build, không lấy dữ liệu trình duyệt.

TypeScript bật strict, noUncheckedIndexedAccess, noUnusedLocals và noUnusedParameters. Xem [VALIDATION.md](VALIDATION.md) cho kết quả từng bộ test và giới hạn.

## Cơ chế chuẩn được tham khảo

Core, máy trạng thái, adapter nghiệp vụ và UI được viết riêng theo yêu cầu, khảo sát trang công khai và fixtures. Không tích hợp SDK booking hay source bot 1Zone có sẵn. Đã tham khảo cách tổ chức workflow/chờ phản hồi của [Automa](https://github.com/AutomaApp/automa), không chép mã. Script Ticketbox cũ được xem để đối chiếu, không dùng endpoint cũ làm contract hiện tại. Nguồn và bằng chứng mỗi website ghi trong [nghiên cứu API](NGHIEN_CUU_API.md).

| Nguồn chính thức | Áp dụng |
|---|---|
| [Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) | Đọc/thao tác DOM trong tab phù hợp |
| [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | Lưu trạng thái ngoài biến global để chịu worker restart |
| [Chrome Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) | Popup/content gửi lệnh, background trả kết quả |
| [Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage) | Local cho cấu hình; session cho phiên camp, đọc/ghi bất đồng bộ |
| [Chrome Alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms) | Nhắc giờ phụ trợ; không coi là đồng hồ server |
| [WXT Entrypoints](https://wxt.dev/guide/essentials/entrypoints) | Đóng gói popup, content, background và demo |
| [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) | Phản ứng với thay đổi DOM |
| [MDN click](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click) | Kích hoạt điều khiển DOM; không bảo đảm website chấp nhận synthetic event |
| [MDN Input value](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/value) | Đọc/ghi giá trị; phát input/change riêng khi cập nhật |
| [MDN Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) | Cô lập phần lớn CSS panel |
| [WAI-ARIA Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) | Vai trò/nhãn và dấu lựa chọn có thể đọc |
| [W3C SVG 2 · title và nhãn](https://www.w3.org/TR/SVG/struct.html) | Tên semantic có thể khác pixel được vẽ; title không cần hiển thị như text |
| [Chrome Web Store Distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution) | Private theo email, Unlisted theo link; không thay thế server cấp quyền |

Các API chuẩn không cung cấp dữ liệu tồn kho, selector, quan hệ zone-seat hay hợp đồng giữ vé của 1Zone. Quy tắc chữ/giá/URL là heuristic theo giao diện, chưa phải tích hợp server được xác nhận. Một số UI cần adapter cụ thể hơn; ảnh map không tự biến thành dữ liệu ghế.
