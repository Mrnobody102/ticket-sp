# Rà soát source và cơ chế tham khảo

> Ngày rà soát: 17/10/2026. Mặc định mới: **1 vé**. Đánh giá dựa trên source, fixtures và kiểm thử extension, không phải chứng nhận tương thích sự kiện Hà Nội chưa có link xác nhận.

## 1. Đánh giá mức sẵn sàng

Tool đã có cấu hình bền, nhắc giờ, đọc trang, gợi ý, overlay và môi trường diễn tập. Có thể dùng để diễn tập và hỗ trợ thao tác trên những mẫu giao diện đã đọc được. Chưa đủ bằng chứng để khẳng định xử lý toàn bộ luồng mua vé Vương Bình Hà Nội.

| Hạng mục | Đánh giá hiện tại |
|---|---|
| Cấu hình mặc định | Popup/demo lấy `DEFAULT_QUANTITY = 1`; cấu hình đã lưu được khôi phục, không bị đổi ngầm |
| Chọn khu vực | Có lọc tên/giá/giới hạn và gợi ý khi đọc được điều khiển phù hợp |
| Ghế do website cấp | Có phân loại và hướng dẫn; không tự giả định random hoặc liền nhau |
| Ghế cụ thể | Phân biệt ghế đơn với khu vực; hỗ trợ gợi ý 1 vé khi ghế có nhãn DOM rõ ràng |
| Nhiều ghế | Chưa lập nhóm hoặc kiểm tra liền nhau; không gợi ý một ghế như thể mua được N vé |
| Phòng chờ | Có nhận diện tổng quát; giữ trạng thái kèm cảnh báo nếu URL mất danh tính event |
| Map/queue thật của Hà Nội | Chưa xác minh; link TP.HCM và map sự kiện khác chỉ tham khảo |
| Giữ chỗ, hết hạn, đặt đơn | Chưa có cơ chế đọc timer giữ chỗ/hết hạn hoặc tự chọn/giữ/đặt vé |

## 2. Phát hiện và sửa trong lần rà soát

| Phát hiện | Ảnh hưởng trước khi sửa | Cách sửa |
|---|---|---|
| Mặc định 2 được đặt trực tiếp ở UI/demo | Lệch yêu cầu mới và dễ sửa thiếu một chỗ | Hằng số `DEFAULT_QUANTITY = 1` dùng chung |
| Một ghế và một khu dùng cùng mô hình phẳng | Giá một ghế có thể bị nhân số lượng và trình bày như một nhóm vé | Thêm `kind: ZONE/SEAT`; ghế đơn chỉ xét khi muốn 1 vé |
| Mất trạng thái queue khi URL không khớp concert | Panel chuyển UNKNOWN dù đã nhận diện được phòng chờ | Giữ trạng thái chặn và nêu rõ chưa xác nhận quan hệ với event; vẫn không gợi ý |
| Chỉ đọc tình trạng disabled, chưa đọc dấu đã chọn | Có thể tiếp tục gợi ý lại lựa chọn người dùng đã chọn | Đọc `aria-selected`, `aria-checked`, input checked; cập nhật observer |
| Đọc option lần nữa khi vẽ khung | Tốn thêm truy vấn và phải ghép lại ID với DOM | Một lần inspect trả snapshot và DOM bindings; overlay dùng đúng bindings đó |
| UI tự tính lại danh sách gợi ý | Logic xếp hạng chạy ở nhiều nơi | Controller tính một lần, truyền cùng kết quả cho panel và overlay |
| Kiểm tra visibility lặp qua nhiều tổ tiên | Lặp việc đọc computed style trong cùng lượt | Cache visibility/text theo lượt inspect; lượt mới không dùng lại cache cũ |
| Adapter gộp nhiều trách nhiệm | Khó sửa riêng đọc DOM, giá/nhãn và phân loại luồng | Tách module DOM, options, selection, orchestration |
| Popup tải dữ liệu trong lúc storage đang đổi | Có thể áp dữ liệu khởi tạo cũ hơn sự kiện thay đổi vừa nhận | Ưu tiên cấu hình mới nhất đã nhận trong lúc chờ load |
| Nhóm ghế cùng giá có tiêu đề | Container bị coi là một zone, che mất các ghế con | Ưu tiên điều khiển con có nhãn/giá đọc được; giữ từng ghế, cấp ID sau khi loại container |
| Điều khiển vé còn hiển thị trước giờ bán | Có thể báo SELECTING dù tiêu đề ghi chưa mở bán | Ưu tiên NOT_READY trước khi đọc lựa chọn; trả danh sách/bindings rỗng |

Hai lỗi cuối được tái hiện bằng kiểm thử thất bại trước khi sửa, gồm ba kiểu container nhóm ghế và trạng thái chưa mở bán còn nút chọn. E2E cũng kiểm tra nhóm ghế có tiêu đề, trạng thái đã chọn và yêu cầu nhiều vé.

Đã bổ sung kiểm tra TypeScript `noUnusedLocals` và `noUnusedParameters` cùng các tùy chọn strict có sẵn. Không thêm một hệ thống backend, monorepo hoặc nhiều lớp abstraction không có nhu cầu chạy thực tế.

## 3. Source được tách theo trách nhiệm nào?

```text
src/core/
  models.ts                 Kiểu dữ liệu và mặc định
  preferences.ts            Validation, đúng event và thời gian
  workflow.ts               Điều kiện gợi ý, trạng thái hiệu lực, nhắc giờ

src/platforms/
  onezone.ts                Phối hợp một lần đọc trang, trả snapshot + bindings
  onezone-dom.ts            Đọc chữ/visibility, cache trong lượt đọc
  onezone-options.ts        Đọc giá/nhãn/điều khiển, phân biệt ghế và khu
  onezone-selection.ts      Suy luận cách chọn chỗ từ mô tả

src/infrastructure/         Chrome storage, message và alarm
src/ui/                     Popup, panel, observer và overlay
src/entrypoints/            Điểm khởi chạy theo ngữ cảnh Chrome/WXT
```

Đây là cách tổ chức module cho một extension nhỏ: logic quyết định có thể test riêng, phần phụ thuộc DOM/Chrome được đặt ngoài core. Các quy tắc URL và validation hiện vẫn dành cho 1Zone; muốn hỗ trợ nền tảng khác còn phải mở rộng chúng cùng manifest và tests. Chưa phải một engine booking đa nền tảng hoàn chỉnh.

## 4. Chọn zone, cấp ghế và chọn ghế khác nhau thế nào?

| Cách mua | Bạn cần thực hiện | Vai trò hiện tại của tool |
|---|---|---|
| `ZONE_ONLY` | Chọn hạng/khu và số vé theo UI | Gợi ý khu phù hợp; không tự kết luận có/không có số ghế nếu quy định chưa rõ |
| `ASSIGNED_SEAT` | Chọn hạng/khu, số vé; nhận ghế do website cấp | Hướng dẫn đúng luồng, không đòi chọn ghế không tồn tại |
| `PICK_SEAT` | Chọn mã/vị trí ghế cụ thể rồi kiểm tra vé đã chọn | Gợi ý ghế có nhãn đọc được cho 1 vé; chưa tìm ghế liền nhau hoặc giải mã canvas |
| `MIXED` | Kiểm tra quy định từng khu | Báo có nhiều cách chọn; chưa tự áp một cách cho mọi khu |

**Tự cấp ghế không đồng nghĩa ngẫu nhiên.** Website có thể cấp theo thứ tự đặt, theo quy tắc riêng hoặc ngẫu nhiên. Chỉ dùng mô tả của suất Hà Nội để kết luận. Tool không tự bốc ghế hoặc gửi yêu cầu cấp ghế.

Với ghế DOM có nhãn rõ ràng, reader có thể phân loại các tên ghế như A1/A2 trong ngữ cảnh chọn ghế. Nếu nhóm chứa ghế có role group/radiogroup và nhãn truy cập, `zoneLabel` được ghi nhận để xét ưu tiên khu. Đây vẫn là heuristic theo giao diện, không phải quan hệ zone/seat được xác nhận bởi API 1Zone.

Yêu cầu 2 vé trên map chỉ có các ghế đơn sẽ không sinh gợi ý ghế đơn nhân giá hai lần. Panel nêu giới hạn và để người dùng chọn trực tiếp. Với yêu cầu 1 vé, các ghế khả dụng chưa được đánh dấu chọn có thể được gợi ý nếu nhãn/giá đọc được.

## 5. Đã dựa vào source hoặc tiêu chuẩn nào?

Repo ban đầu chỉ có tài liệu. Phần core, adapter 1Zone và UI nghiệp vụ được viết theo brief, giao diện công khai và fixtures của project. Không có SDK booking 1Zone hoặc một repo bot 1Zone có sẵn được tích hợp vào dependency. WXT, React, Vite và các công cụ test là thư viện sử dụng trong project.

Các tài liệu chính thức đã đọc/đối chiếu:

| Nguồn | Cơ chế được áp dụng | Giới hạn của việc tham khảo |
|---|---|---|
| [Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) | Chạy bộ đọc trong trang theo match pattern, truy cập DOM và trao đổi với extension | Không cung cấp selector hoặc hiểu biết riêng về 1Zone |
| [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | Dữ liệu bền lưu storage, chuẩn bị cho worker bị dừng/chạy lại | Không coi biến global của worker là task store |
| [Chrome Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) | Popup/content script gửi lệnh, background trả kết quả bất đồng bộ | Lệnh và validation nghiệp vụ do project định nghĩa |
| [Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage) | Lưu JSON cục bộ và nhận thay đổi qua storage events | Không thay thế xác nhận giao dịch từ website |
| [Chrome Alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms) | Đặt alarm theo thời gian và dựng lại từ cấu hình khi cần | Lịch có thể trễ do browser/OS; không phải đồng hồ mở bán của server |
| [WXT Entrypoints](https://wxt.dev/guide/essentials/entrypoints) | Tách popup, background, content script, trang demo và sinh bản build | Framework đóng gói extension, không phải thư viện săn vé |
| [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) | Quan sát thay đổi DOM, ngắt khi cleanup | Cách throttle và dấu hiệu cần đọc là quyết định của project |
| [MDN Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) | Tách phần lớn CSS/UI của panel khỏi website | Không tạo dữ liệu ghế từ ảnh và không phải ranh giới bảo mật tuyệt đối |
| [WAI-ARIA Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) | Tham khảo vai trò/nhãn và trạng thái lựa chọn có thể đọc | ARIA mô tả semantics của UI, không chuẩn hóa dữ liệu vé của 1Zone |

Các phần **tự viết**, chưa có hợp đồng dữ liệu chính thức với 1Zone: nhận diện phòng chờ/checkout bằng chữ, parse giá, gán kiểu ghế/khu, đọc giới hạn số vé, xác định liên hệ với suất qua URL, xếp hạng ưu tiên và quy tắc khi gặp canvas/iframe.

Vì vậy, dùng API chuẩn giúp extension vận hành có cấu trúc và kiểm thử được; độ tương thích với sự kiện cụ thể vẫn phải được chứng minh bằng DOM/luồng thật. Kết quả chạy kiểm tra được ghi trong [VALIDATION.md](VALIDATION.md).
