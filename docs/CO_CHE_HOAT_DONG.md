# Cơ chế camp vé · bản 0.5.5

0.5.2 sửa ngày bán Hà Nội thành 12:00 ngày 18/10/2026 UTC+7. Khi cài/cập nhật, chỉ sửa cấu hình đúng suất còn dùng chính xác mốc cũ 12:00 ngày 19/10; giữ hạng/số lượng và dừng phiên cũ, không tự bật mua. Giờ tùy chỉnh khác và sự kiện khác được giữ nguyên.

Từ 0.5.1, queue sau bước vào mua được xử lý như sau: OPENING → queue thì trở về READY để chờ; khi được trả về event có thể vào mua tiếp. Không reset ADVANCING vì đó có thể là yêu cầu giữ vé chưa rõ kết quả. START/STOP có trạng thái đang chờ: tránh gửi START hai lần, không nhận lại progress revision cũ, không để phản hồi START muộn ghi đè phiên đã tiến bước hoặc vừa dừng. STOP ngắt hành động cục bộ trước khi chờ worker. Các kiểm tra này không thêm request vào từng click.

Popup không sở hữu vòng lặp chọn vé nên đóng popup vẫn chạy trên tab chủ. Máy ngủ/đóng băng tab làm gián đoạn timer; Chrome điện thoại không hỗ trợ cài bản này. Hướng dẫn vận hành ngắn nằm ở [CHUAN_BI_18_10.md](CHUAN_BI_18_10.md).

0.5.0 giữ nguyên core/runner và tách việc nhận diện tên vé vào `core/ticket-identity.ts`: ID nếu có; nếu không thì tên hạng hoặc zone chính xác từ cùng bản ghi API, kèm giá. Lưu `zoneName` và kiểm tra lại khi bật camp. Ảnh có alt/ARIA, SVG có role và title/ARIA được đọc như điều khiển; SVG dùng bubbling MouseEvent vì không có HTMLElement.click. Không OCR hoặc bấm theo tọa độ.

Diễn tập mặc định mở luồng tương tác: chọn 1–2 vé → Chạy thử → xem đúng số lượng ở thanh toán → Làm lại. Các màn nhận diện riêng nằm trong mục thu gọn và không chạy automation. `testing/rehearsal.ts` tạo dữ liệu cục bộ, không dùng Chrome storage/API. Cấu hình show thật không bị sửa.

Khi đổi suất, bản nháp bỏ giờ bán và số lượng cũ ngay trước yêu cầu tải hạng; show chưa có giờ bán được xác minh phải nhập giờ do ban tổ chức cung cấp. Riêng mốc Hà Nội là preset do người dùng xác nhận. Phiên bản UI/content/worker được kiểm tra lúc khởi tạo, không kiểm tra lại trong từng click. Panel hiện version để nhận ra tab cũ. Phân phối và cấp quyền thương mại tách khỏi adapter; xem [PHAT_HANH.md](PHAT_HANH.md).

Bản hiện tại kết nối **tìm sự kiện → chọn đúng suất/hạng/giá → camp tới checkout**. Bản 0.2.0 có bộ thực thi tự chọn vé; 0.3.0 bổ sung catalog API, cấu hình theo ID/giá và kiểm tra trước khi chạy. Tài liệu phân biệt kiểm thử cục bộ, GET công khai đã chạy thật và booking chưa xác minh trên sự kiện mục tiêu.

0.4.0 bổ sung preset Hà Nội, modal theo dấu hiệu public của 1Zone, lịch microtask, reload một lần tại mốc bán và benchmark lặp. Hướng dẫn thực tế: [sẵn sàng mở bán](SAN_SANG_MO_BAN.md).

0.4.1 kiểm tra phiên bản giao diện/worker khi mở cấu hình, mở workspace/demo bằng link extension trực tiếp và chuyển nhập hạng thủ công vào tùy chọn chủ động. Luồng mặc định tải catalog rồi dùng select; lỗi tải không tự chuyển sang textarea.

0.4.2 bắt lỗi đọc phiên lúc khởi tạo content bằng `Promise.allSettled`. Nếu không đọc được cấu hình hoặc phiên, panel hiển thị lỗi và không tạo runner. Lỗi quyền kiểu worker cũ chỉ được đổi thành hướng dẫn Reload với các lệnh AUTO hợp lệ; quyền SAVE từ content vẫn bị chặn. UI gom thông tin sự kiện, đặt hạng/số lượng/giờ trước, giữ Lưu/Bắt đầu ở footer. `public/huong-dan.html` là hướng dẫn tĩnh, dùng được trong extension và mở trực tiếp sau giải nén.

## 1. Đầu vào và đầu ra

Từ 0.5.5, **Thao tác khác → Lưu báo cáo** xuất snapshot mới và tiến độ phiên hiện tại thành JSON. Đây là dữ liệu chẩn đoán, không phải lịch sử click hoặc xác nhận giữ vé. Không có logger hoặc request mạng mới trong đường thực thi; xem [cách đánh giá lượt thật](SAN_SANG_MO_BAN.md#đánh-giá-lượt-chạy-thật).

`snapshot.state` là trạng thái nội bộ có kiểu `WorkflowState`, được adapter website tạo ra. Ví dụ `snapshot.state === 'CHECKOUT'` nghĩa là bộ đọc đã phân loại màn hiện tại là thanh toán, nên core dừng tự động hóa. Đây không phải phép so sánh chữ trên website với từ CHECKOUT. Phần nhận diện 1Zone đọc HTML/ARIA, nhãn ảnh/SVG, ID điều khiển, giá, số lượng và trạng thái hiển thị/disabled; câu chữ được chuẩn hóa dấu, hoa/thường và khoảng trắng.

1Zone vẫn cần mapping nút và cấu trúc riêng. Không có một bộ text button chuẩn dùng được cho mọi nền tảng. Nhãn mới hoặc DOM không đủ bằng chứng có thể khiến adapter dừng. 0.5.4 yêu cầu tiêu đề checkout đúng ngữ nghĩa đã hỗ trợ kèm form/điều khiển thanh toán; FAQ “Thanh toán thế nào?” và form nhận email không đủ. Classifier này nhận diện trang, không xác nhận server đã giữ vé.

Bản 0.5.2 còn kiểm tra phiên bản content script trong tab vé trước khi bật từ popup. Tab chưa nạp mã mới không được báo là đã camp. Kiểm tra kết nối này chỉ chạy khi bắt đầu, không nằm trên đường chọn vé. API `/zones` bổ sung đủ 12 khu của 4 hạng cho suất Hà Nội; khi đã chọn khu cụ thể, modal phải khớp khu ấy.

Diễn tập dùng cùng adapter, state machine và runner nhưng có transport lưu trong bộ nhớ, website tổng hợp và không gọi mạng đặt vé. Ba tình huống cho thấy mua bình thường, chờ website cho vào, và tạm dừng để xác minh. Nút “Cho vào chọn vé”/“Đã xác minh · chạy tiếp” chỉ điều khiển bài mô phỏng; bản thật chờ website và người dùng tương ứng. Không dùng kết quả diễn tập làm bằng chứng đã giữ được vé trên server.

Đầu vào gồm nền tảng, link concert/suất, giờ mở bán, số vé, ngân sách tổng và thứ tự zone/hạng vé. Mặc định **1 vé**, ngân sách trống. Cấu hình cũ được giữ đúng lựa chọn đã lưu.

Khi bấm **Bắt đầu camp**, tool dùng cấu hình đã lưu; nếu chọn qua catalog thì tải mới và đối chiếu dữ liệu trước. Sau đó vào bước mua, chọn lựa chọn phù hợp, cập nhật số lượng rồi bấm tiếp. Đầu ra thành công của bộ thực thi là **nhận diện trang checkout**. Đây chưa phải xác nhận server đã giữ vé hoặc thanh toán thành công.

Đăng nhập trước, hoàn thành xác minh khi website yêu cầu và thanh toán cuối vẫn là những bước người dùng thực hiện. Nhắc giờ là tính năng phụ.

## 2. Kiến trúc

```mermaid
flowchart LR
  UI[Popup / Workspace / Panel] --> BG[Background: session + revision]
  UI --> CAT[Catalog service: GET / cache]
  CAT --> API[Provider 1Zone / Ticketbox]
  API --> DATA[Suất + ID hạng + giá]
  DATA --> UI
  BG --> RUN[Runner trong tab chủ]
  RUN --> READ[Platform adapter: đọc DOM]
  READ --> CORE[Core: quyết định bước tiếp]
  CORE --> BG
  BG --> VERIFY[Đọc và kiểm tra lại]
  VERIFY --> EXEC[Adapter: click / input]
  EXEC --> SITE[Website phản hồi]
  SITE --> READ
```

| Lớp | Trách nhiệm | Phụ thuộc |
|---|---|---|
| Core | Model, URL policy, validate, xếp hạng, quyết định | TypeScript thuần |
| Application | Chạy từng bước, hẹn giờ, chống lệnh cũ, kiểm tra lại trước thao tác | Core, contract, transport được truyền vào |
| Platform | Provider chuyển schema API; adapter hiểu DOM/điều khiển riêng | Core; transport được truyền vào hoặc Browser DOM |
| Infrastructure | GET/cache, Chrome storage/session, messages, tab và alarm | Core, Chrome/fetch APIs |
| UI / entrypoints | Form, trạng thái, observer, lắp các thành phần | Các lớp trên |

Core không import React, Chrome hoặc DOM. Runner không import adapter 1Zone. Website khác dùng lại core và runner qua [contract](../src/platforms/contracts.ts) và [registry](../src/platforms/registry.ts).

## 3. Các kiểu dữ liệu

[models.ts](../src/core/models.ts) chứa `EventPreferences`, `PageSnapshot`, `VisibleOption` và cấu hình. `platform` là kiểu nền tảng chung. Mỗi lựa chọn ghi `ZONE/SEAT`, nhãn, nhãn khu nếu có, giá, tình trạng khả dụng và dấu đã chọn.

[automation.ts](../src/core/automation.ts) định nghĩa:

| Kiểu | Ý nghĩa |
|---|---|
| AutoRun | ID phiên, tab chủ, revision, fingerprint cấu hình, thời gian bắt đầu/hết hạn, progress |
| AutoProgress | Bước hiện tại, lựa chọn đã nhắm tới, mốc hành động, số lượng cần xác nhận |
| AutoPage | Snapshot chuẩn hóa, số nút vào mua/đi tiếp, các lựa chọn có thể bấm, số lượng đọc được, lỗi |
| AutoDecision | Chờ với mốc đánh thức, hoặc chuyển bước với một hành động |
| AutoAction | ENTER, CHOOSE, QUANTITY, ADVANCE, RELOAD một lần khi được cấu hình |

ID option chỉ tồn tại trong một lần đọc. Qua các lần đọc, lựa chọn được đối chiếu bằng loại, nhãn, khu, giá và ID hạng nếu DOM cung cấp. Nếu hai lựa chọn trùng các dấu hiệu này, core dừng thay vì suy đoán vị trí.

### Catalog và cấu hình theo dữ liệu nguồn

[catalog.ts](../src/core/catalog.ts) định nghĩa các kiểu chung:

| Kiểu | Nội dung |
|---|---|
| ConcertSummary / ConcertDetail | Event ID, tên/link/địa điểm, các suất và currency |
| Performance | ID suất, địa điểm, giờ diễn, giới hạn số lượng nếu có |
| TicketType / TicketCatalog | ID hạng, tên, giá, giới hạn, mode ghế, thời điểm đọc và suất sở hữu |
| CatalogSelection | Event/suất, giới hạn suất; danh sách ID hạng + tên + giá + mode ghế + giới hạn đã chọn theo thứ tự |
| CatalogProvider | Contract search/detail/tickets, không có thao tác đặt vé |

`onezone-catalog.ts` đọc search API, JSON eventData trong HTML và summary hạng vé. `ticketbox-catalog.ts` đọc search và event/showings/ticketTypes. Mỗi provider kiểm tra schema, danh tính và giá trước khi trả model chung. Hai parser không gọi nhau.

`catalog-service.ts` sở hữu GET allowlist, timeout, cache và gộp request. Những GET tra cứu không đi vào hàng đợi tuần tự của automation. UI không nhận dữ liệu JSON thô hay token. `EventFinder` bỏ response đến muộn bằng phiên bản request; nhiều suất phải chọn rõ, link có ID suất sai không tự chuyển sang suất khác. Giờ diễn luôn ghi riêng, người dùng nhập giờ bán theo thông báo chính thức.

`TicketPriorities` dùng native select, cho thêm/đổi thứ tự/bỏ hạng. Lưu cấu hình giữ ID và giá; reopen vẫn giữ snapshot đã chọn. Form sửa chưa lưu hoặc cấu hình đổi ở cửa sổ khác sẽ khóa Bắt đầu camp cho tới khi lưu/tải lại.

`extension-runtime.ts` nhúng phiên bản build vào giao diện và worker. Lệnh RUNTIME_INFO chỉ từ trang extension trả phiên bản/protocol; khác bản, thiếu hợp đồng hoặc quá 4 giây thì hiển thị hướng dẫn Reload. Các message client dùng chung cách diễn giải lỗi worker cũ/mất context, giữ nguyên lỗi nghiệp vụ. Kiểm tra này chỉ ở màn cấu hình; runner đặt vé không gọi handshake trước từng click. Header hiển thị phiên bản build để người dùng kiểm tra cập nhật.

Giới hạn số vé trên form là giá trị nhỏ nhất trong các giới hạn đã biết của suất và những hạng ưu tiên: mỗi phương án phải đáp ứng toàn bộ số vé. Không biết giới hạn thì không gán nó thành giới hạn của website; mức 100 là trần cấu hình nội bộ. Preset Hà Nội chỉ điền bản nháp giờ/link/1 vé; thứ tự hạng và số vé do người dùng chuẩn bị trước. Mọi show dùng chung cơ chế lưu và preflight.

Khi bật camp có catalog, detail và tickets được GET mới song song (`no-store`, không dùng cache). [catalog-validation.ts](../src/core/catalog-validation.ts) đối chiếu event/suất, ngày/địa điểm, VND, thời gian kết thúc, giới hạn số lượng, ID/tên/giá. Sai lệch thì không tạo phiên camp. Cấu hình cũ nhập thủ công vẫn dùng được, nhưng không có đối chiếu catalog này.

Khi chọn trên DOM, hạng ưu tiên phải khớp ID nếu có; thiếu ID thì khớp tên đã chuẩn hóa. Giá DOM phải khớp giá snapshot của hạng ưu tiên. Tình trạng trong catalog không thay thế phản hồi giữ vé của website. Chi tiết endpoint, cache và bằng chứng khảo sát nằm trong [nghiên cứu API](NGHIEN_CUU_API.md).

## 4. Máy trạng thái

```mermaid
stateDiagram-v2
  [*] --> READY
  READY --> OPENING: tới giờ và có một nút mua
  OPENING --> READY: nhận diện bước chọn vé
  READY --> CHOOSING: có lựa chọn hợp lệ
  CHOOSING --> QUANTITY: website báo đã chọn
  QUANTITY --> SETTING_QUANTITY: cần đổi số lượng
  SETTING_QUANTITY --> QUANTITY: đọc được số lượng mới
  QUANTITY --> ADVANCING: đúng lựa chọn và số lượng
  ADVANCING --> CHECKOUT: thấy checkout
  READY --> PAUSED: không thao tác được chắc chắn
  CHOOSING --> PAUSED: hết thời gian xác nhận
  ADVANCING --> PAUSED: hết thời gian xác nhận
  CHECKOUT --> [*]
```

Hàm `decideAutomation()` là hàm thuần: nhận phiên, trang chuẩn hóa, sở thích và thời gian; trả quyết định. Hàm không click và không ghi storage.

Quy tắc ưu tiên:

1. Dừng nếu cấu hình đổi hoặc phiên hết hạn.
2. Nhận diện checkout thì kết thúc, không bấm nút cuối.
3. Đăng nhập, CAPTCHA, thông báo giữ chỗ thất bại/hết hạn rõ ràng thì PAUSED.
4. Phòng chờ thì WAIT; không refresh, không gửi yêu cầu lấy chỗ khác.
5. Kiểm tra đúng concert/suất, giờ bán và giới hạn số vé.
6. READY chọn ưu tiên phù hợp. Hết vé hiển thị thì xét lựa chọn tiếp theo theo cấu hình.
7. Sau click, phải thấy dấu đã chọn; sau đổi số lượng, phải đọc được giá trị mục tiêu.
8. Chỉ ADVANCE khi đúng lựa chọn, đủ số lượng và có đúng một nút đi tiếp khả dụng.

Thời gian chờ xác nhận lựa chọn/số lượng khoảng 5 giây; điều hướng khoảng 15 giây. Quá thời gian sẽ dừng, không tự lặp click. Lúc khởi tạo cho phép tối đa 15 giây để giao diện chưa nhận diện được hoàn tất render; canvas/iframe không đọc được không được coi là đang tải.

## 5. Vì sao ghi trạng thái trước khi click?

[automation-service.ts](../src/infrastructure/automation-service.ts) chạy trong hàng đợi tuần tự của background. Content gửi ID phiên, revision hiện tại và progress tiếp theo.

Ví dụ:

```text
Tab: READY, revision=0
→ ghi CHOOSING với revision kỳ vọng 0
Background: chấp nhận, lưu revision=1
→ tab đọc lại DOM rồi click chọn
→ website phản hồi selected=true
→ ghi QUANTITY với revision kỳ vọng 1
```

Cùng lệnh revision=0 được gửi lại sẽ bị từ chối. Nếu tab điều hướng hoặc worker khởi động lại sau bước ghi, trạng thái vẫn là CHOOSING; tool chờ kết quả hoặc báo chưa xác nhận, không quay lại bấm chọn lần nữa.

Cơ chế này ưu tiên tránh lặp hành động. Nó **không tạo giao dịch nguyên tử giữa storage và server 1Zone**: nếu tab đóng sau khi ghi nhưng trước khi click, bước có thể chưa xảy ra. Kiểm tra trực tiếp rồi bắt đầu lại.

Sau bước ghi bất đồng bộ, [runner](../src/application/automation-runner.ts) đọc lại DOM và chạy lại quyết định từ trạng thái trước đó. Nếu nút, lựa chọn, URL hoặc giá đổi thì hủy hành động và PAUSED. Dừng phiên hoặc đổi cấu hình trong lúc chờ cũng làm lệnh cũ mất hiệu lực.

## 6. Một tab và vòng đời Chrome

Background lưu cấu hình trong `chrome.storage.local`; phiên camp trong `chrome.storage.session`. Dữ liệu session mặc định chỉ cho ngữ cảnh extension tin cậy; content nhận phiên của chính tab mình qua messages.

- Một phiên có một tab chủ; tab khác chỉ theo dõi.
- Đóng tab chủ hủy phiên. Reload/điều hướng tab trong cùng Chrome có thể tiếp tục trạng thái đã lưu.
- Worker dừng/chạy lại không làm mất session.
- Đóng/mở Chrome, reload/cập nhật/disable extension làm mất session; phải bắt đầu camp lại.
- Lưu lại cấu hình hoặc dừng theo dõi hủy phiên.
- Ẩn panel vẫn chạy camp; popup còn nút dừng.
- Phiên hết hạn sau 60 phút kể từ thời điểm muộn hơn giữa giờ bán và lúc bắt đầu.

Không có quy trình tự mở nhiều tab/tài khoản hoặc phối hợp giành chỗ.

## 7. Adapter 1Zone đọc và thao tác thế nào?

Các module [onezone.ts](../src/platforms/onezone.ts), [DOM](../src/platforms/onezone-dom.ts), [options](../src/platforms/onezone-options.ts), [selection](../src/platforms/onezone-selection.ts), [automation](../src/platforms/onezone-automation.ts) tách riêng nhận diện và thực thi.

Bộ đọc bỏ chữ ẩn, scripts, template và UI extension. Cache visibility/text chỉ sống trong một lần đọc. Snapshot và bindings trả cùng lượt để khớp đúng phần tử.

Lựa chọn phải có nhãn và đúng một giá rõ ràng. Thẻ giới thiệu chỉ có nút xem thông tin không được coi là vé mua được. Các ghế cùng giá trong một container vẫn là từng ghế; không gộp thành zone. Dấu selected đọc từ ARIA/radio, gồm `aria-pressed`.

Bộ thao tác chỉ bind điều khiển có ngữ nghĩa rõ ràng:

| Thao tác | Cách thực hiện |
|---|---|
| ENTER | Nút chính `btn-by-ticket` đã biết nếu duy nhất, hoặc một nút/link mua khả dụng không mơ hồ; link booking phải đúng concert/calendarId |
| CHOOSE | Nút/role chọn trực tiếp hoặc một điều khiển chọn duy nhất trong card |
| QUANTITY | Native setter + input/change cho input/select; bấm từng bước cho ARIA stepper hoặc stepper modal 1Zone đã đối chiếu |
| ADVANCE | Một điều khiển tiếp tục đã biết; loại nút trong thẻ vé, nút thanh toán/xác nhận cuối |

Giá/ngân sách, selected và số lượng được kiểm tra lại trước đi tiếp. Thay đổi thuộc tính DOM được quan sát; input/change cũng được lắng nghe vì gán property không nhất thiết tạo mutation.

[onezone-modal.ts](../src/platforms/onezone-modal.ts) đọc modal có `btn-add`, `btn-sub`, số lượng trong span và `btn-continue`. Tên hạng và giá hiện tại phải khớp catalog; giá gốc gạch ngang không tham gia so sánh. Việc modal hiển thị đúng một hạng là bằng chứng chọn trong biến thể này. Reader thẻ có tiêu đề p cũng yêu cầu quote khớp và một nút chọn/mua rõ ràng. Các dấu hiệu lấy từ component public và test bằng mô phỏng, chưa phải DOM booking đăng nhập của suất thật. Tool không truy cập React store hoặc token xác minh.

Synthetic click/input là cơ chế DOM; một số ứng dụng không nhận loại sự kiện này hoặc không công khai trạng thái cần đọc. Khi đó cần bổ sung adapter từ DOM thật, không tuyên bố tương thích bằng fixture.

## 8. Zone, tự cấp ghế và chọn ghế

- ZONE_ONLY / ASSIGNED_SEAT: tự chọn khu rồi đặt số vé. Tự cấp ghế không mặc định là random hay liền nhau.
- PICK_SEAT: hiện tự chọn một ghế có nhãn/giá đọc được cho yêu cầu 1 vé.
- Nhiều vé với ghế riêng: chưa ghép nhóm, chưa tối ưu liền nhau.
- MIXED hoặc cần chọn ghế sau zone: dừng nếu chưa xác định được luồng khu tương ứng.
- Canvas/iframe thiếu dữ liệu: chưa có bộ thao tác tọa độ/map.

Nếu website không thể hiện selected hoặc số lượng đủ rõ, tool không đi tiếp chỉ vì nút đã được bấm.

## 9. Tốc độ được tối ưu ở đâu?

Ở chế độ theo dõi, nhiều mutation được gom theo khoảng 600 ms. Khi có phiên camp hoạt động hoặc lượt urgent, controller hủy timer chậm đang chờ và dùng microtask thay cho khoảng gom 16 ms. Runner bắt đầu trước phần tính highlight/render, xử lý tuần tự và phản ứng sau mỗi bước; không đợi countdown UI một giây.

Không có vòng polling mạng/refresh lặp. Khi bật `refreshAtSale`, đúng trang còn NOT_READY trong 15 giây từ mốc bán được reload một lần. Core ghi `releaseReloadedAt` trước hành động và giữ nó qua điều hướng/các bước; sau reload có khoảng chờ hydration mới. Queue/challenge/selection/checkout được xét trước nên không bị refresh. Các mốc giờ bán, timeout và hết phiên dùng timer; DOM/event đánh thức khi cần đọc lại.

Chi phí mỗi hành động gồm đọc DOM, quyết định, ghi session qua background, kiểm tra lại và click, sau đó chờ website phản hồi. Tiết kiệm thời gian ở phần người dùng tìm/chọn/bấm; không làm server mở bán sớm hơn.

`selectionStartedAt` và `checkoutReachedAt` đo thời gian chọn → nhận diện checkout trong phiên. Đây gồm lịch browser và thời gian phản hồi trang, không đo được hàng đợi server nội bộ. Số đo mô phỏng trong [VALIDATION.md](VALIDATION.md) chỉ áp dụng cho fixture.

## 10. Mở rộng nền tảng khác

[platform-catalog.ts](../src/core/platform-catalog.ts) là cấu hình miền thuần: ID, tên, origin, route alias và tham số suất. Validation suy ra nền tảng từ URL và đối chiếu trường platform. Manifest/content matches lấy cùng danh mục.

[BrowserPlatformAdapter](../src/platforms/contracts.ts) chuẩn hóa snapshot, bindings hiển thị, AutoPage và executor. Registry chọn adapter theo URL. Runner không rẽ nhánh theo tên website; UI dùng catalog origin/integration để phân biệt nguồn tra cứu và khả năng camp.

Quy trình thêm nền tảng:

1. Khảo sát trang/luồng thực tế, xác định URL policy và host cần quyền.
2. Viết adapter chuyển DOM của website sang model chung; tách hàm đọc và thực thi.
3. Khai báo capabilities, đăng ký registry và cấu hình URL.
4. Thêm fixtures gồm thành công, hết vé, phòng chờ, lỗi, checkout; chạy cùng test core và E2E adapter.
5. Bổ sung kiểu hành động/core chỉ khi có nhu cầu nghiệp vụ thật chưa biểu diễn được.

Ticketbox đã có provider tra cứu và quyền GET API; chưa có content script/booking adapter. CTicket chưa có provider hoặc adapter. Thêm catalog không tự bật khả năng mua vé; booking cần contract, URL policy và E2E riêng.

## 11. Nhắc giờ, dữ liệu và kiểm chứng

Alarm là phần phụ, lưu dấu đã nhắc theo URL + giờ; khôi phục từ cấu hình khi worker chạy lại. Cấu hình, timer và session nằm trên máy; không đọc mật khẩu/thẻ và không có backend.

Unit tests kiểm tra quyết định, URL/UTC+7, DOM và Chrome session mock. Tests runner trì hoãn bước ghi để xác minh dừng/đổi DOM không gây click cũ. E2E chạy extension production với trang có tương tác và kiểm tra nút thanh toán cuối không bị bấm.

Demo [booking-demo.ts](../src/testing/booking-demo.ts) gắn hành vi vào fixture cục bộ, dùng cùng core/runner/adapter và transport bộ nhớ. Demo không sửa phiên hoặc cấu hình thật.

Đã tìm được URL/metadata/hạng vé suất Hà Nội, nhưng chưa có DOM booking của phiên đăng nhập hợp lệ để xác nhận luồng tự đặt trên sự kiện mục tiêu. [Khảo sát](KHAO_SAT_1ZONE.md) và [nghiên cứu API](NGHIEN_CUU_API.md) ghi bằng chứng công khai; [kết quả kiểm tra](VALIDATION.md) ghi phạm vi đã chạy.

Tài liệu cơ chế chuẩn: [Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [HTMLElement.click](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click), [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver). Quy tắc vé và máy trạng thái là code riêng của project, không phải SDK booking 1Zone.
