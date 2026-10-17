# Khảo sát case 1Zone và ý nghĩa với tool

> Ngày đối chiếu: 17/10/2026. Mục tiêu người dùng là **Vương Bình tại Hà Nội**, 1–2 vé, không đặt trần ngân sách. URL TP.HCM và sơ đồ sự kiện khác dùng để nghiên cứu; không tự lưu chúng thành cấu hình mua vé.

> **Cập nhật 18/10/2026, bản 0.3.0:** API tìm kiếm đã trả [Vương Bình Mâm 2 tại Hà Nội](https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm), event `aAq6NT`, suất `8h0YGm`, tại Cung Thiếu nhi Hà Nội. Đã đọc hạng `HAI QUÝ - EB`, `BA THƯƠNG - EB`, `TƯ MẾN - EB`, `ÚT CƯNG - EB`; metadata ghi giờ diễn 11:00 ngày 21/11/2026, **chưa xác minh giờ mở bán**. Xem [nghiên cứu API](NGHIEN_CUU_API.md) cho giá, giới hạn và phạm vi tích hợp. Các mục khảo sát DOM dưới đây ghi lại lần quan sát trước đó.

## 1. Những gì đã kiểm tra được

Đã mở sáu URL bằng Chromium với profile tạm, không đăng nhập, không click điều khiển của website và không gửi lệnh chọn/giữ vé. Báo cáo quan sát DOM nằm ở `artifacts/public-cases/`; đây là bằng chứng của lần quan sát, không phải dữ liệu tồn kho theo thời gian thực.

| Case | Quan sát | Ý nghĩa kỹ thuật |
|---|---|---|
| [Vương Bình TP.HCM](https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than?calendarId=SEsc9b) | Trang tham khảo hiển thị địa điểm White Palace tại TP.HCM; các hạng có hậu tố đợt bán | Giữ nguyên danh tính suất; không chuyển calendarId này sang Hà Nội |
| [Lavender: trang event](https://ticket.1zone.vn/events/lavender-flower-50-nam-cuoc-doi?calendarId=UlSY5H) | Địa điểm Cung Thiếu nhi Hà Nội; thẻ tên/giá/quyền lợi và ảnh alt `Seatmap` | Đọc được danh mục giới thiệu không đồng nghĩa đọc được ghế khả dụng |
| [Lavender: link booking](https://ticket.1zone.vn/booking/lavender-flower-50-nam-cuoc-doi?calendarId=UlSY5H) | Trong phiên chưa đăng nhập, chuyển về `/events/` cùng slug/calendarId | Chưa quan sát được bước chọn ghế tương tác ở link này |
| [Tiệc Ngủ Hà Nội](https://ticket.1zone.vn/events/tiec-ngu-cai-tour-dau-tien-cua-thang-ha-noi-12443?calendarId=kBjRtS) | Có lựa chọn nhiều ngày/thành phố; hạng đứng/ngồi và hạng hạn chế tầm nhìn | Không gộp các suất, không coi mọi hạng ghế có cùng đặc tính |
| [Trạm Yêu 5](https://ticket.1zone.vn/events/tram-yeu-5) | Quy định mô tả hệ thống cấp ghế tự động | Có luồng chọn hạng/số lượng mà không chọn ghế cụ thể |
| [Ngày em đến](https://ticket.1zone.vn/events/ngay-em-den) | Quy định mô tả mua theo khu vực, không chọn chỗ | Có luồng chọn khu vực khác với sơ đồ ghế |

Link Lavender người dùng gửi có dấu phẩy cuối `calendarId=UlSY5H,`. Lần khảo sát dùng `UlSY5H` vì coi dấu phẩy là dấu câu trong tin nhắn, và ghi rõ giả định này. Tool không tự bỏ dấu câu trong calendarId: ID sai vẫn phải được xem là suất khác.

Ở lần khảo sát ngày 17/10, các trang trên chưa cung cấp URL suất Vương Bình Hà Nội. API search ở lần cập nhật 18/10 đã tìm được URL như ghi ở đầu tài liệu. Vẫn không suy từ lịch biểu diễn ra giờ bán.

## 2. Ảnh và sơ đồ giúp xây tool ở điểm nào?

| Tư liệu | Giúp xác định | Không chứng minh được |
|---|---|---|
| Ảnh thẻ hạng vé | Cách viết tên, giá, hậu tố, mô tả quyền lợi; bố cục ngang/dọc | Nút đang click được, số lượng còn lại, ID đặt vé |
| Ảnh khu vực đứng/ngồi/nằm | Sự kiện có nhiều dạng khu vực; cần ưu tiên theo tên cụ thể | Mỗi vùng đều là ghế có số hoặc cùng một cách chọn |
| Ảnh sơ đồ có sân khấu/lối đi/FOH | Vị trí tương đối, vùng cần tránh, trái/phải và khả năng chia nhiều khối | Tọa độ click ổn định, ghế đang trống, hai ghế liền nhau trên hệ thống |
| Ảnh đồng hồ giữ chỗ | Cần phân biệt thời gian phiên chọn vé với countdown mở bán | Đã giữ thành công ghế nào hoặc có thể tự kéo dài phiên |
| DOM nhìn thấy của trang thật | Quan hệ giữa nhãn, giá, điều khiển, disabled và sơ đồ | Tồn kho server hoặc kết quả giao dịch trước khi website xác nhận |

Ví dụ, một ảnh nền có tên zone chỉ có các pixel màu và chữ. Bộ đọc hiện tại không biến các pixel đó thành danh sách ghế. Ngay cả khi bản đồ nền là ảnh, website vẫn có thể đặt lớp SVG/canvas/DOM tương tác phía trên; cần xem lớp tương tác thực tế để biết có dữ liệu đủ rõ hay không.

Đếm được nhiều thẻ `svg` trên trang giới thiệu không chứng minh có sơ đồ SVG đọc được: logo và icon cũng là SVG. Lần khảo sát chưa quan sát được lớp chọn ghế của Lavender nên chưa kết luận loại renderer của nó.

### Hệ quả đối với mô hình dữ liệu

Những ảnh này cho thấy cần phân biệt các khái niệm:

```text
Sự kiện → Suất diễn / calendarId
             → Hạng vé / quyền lợi / giá
                  → Khu vực trên sơ đồ
                       → Ghế cụ thể, nếu khu vực đó cho chọn ghế
```

Đây là mô hình đề xuất để mở rộng, không phải cấu trúc đã tích hợp đầy đủ. Giá giống nhau không làm hai khu vực thành một: ảnh có SVIP A/B cùng giá, và hai khu ngồi cùng giá nhưng nằm hai phía. Tên hạng cũng không xác định duy nhất vị trí khi một hạng được chia thành nhiều khối.

Trong cùng event có thể có khu đứng, khu ngồi hoặc khu nằm. Sau đợt rà soát, `VisibleOption.kind` phân biệt khu vực và ghế đơn; `zoneLabel` lấy được từ nhóm có nhãn rõ ràng, mode `MIXED` báo nhiều cách chọn. Đây vẫn là mô hình đơn giản: chưa có quan hệ đầy đủ hạng–zone–ghế, cách chọn của từng khu trên map thật, ghế liền nhau hay ưu tiên trái/phải/tầng.

## 3. Áp dụng cho Vương Bình Hà Nội

Trang TP.HCM có nhóm tên tham khảo **HAI QUÝ - GS**, **BA THƯƠNG - GS**, **TƯ MẾN - GS**, **ÚT CƯNG - GS**. Không tự bỏ hậu tố `- GS` hoặc mặc định suất Hà Nội giữ nguyên tên, giá và quyền lợi. Cấu hình ưu tiên hiện so khớp tên sau chuẩn hóa dấu/chữ hoa, không tự tạo alias giữa hai đợt bán.

Ảnh người dùng cung cấp cho thấy có thể chia một hạng thành nhiều khối, với sân khấu và FOH ảnh hưởng vị trí. Đây là thông tin để chuẩn bị sở thích; chưa phải sơ đồ đã xác nhận của Hà Nội.

Map Lavender tại Cung Thiếu nhi giúp nghiên cứu một kiểu giao diện/địa điểm tham khảo. Cùng địa điểm không bảo đảm cùng bố trí sân khấu, số tầng được mở, ghế bị khóa, vùng camera hoặc cách gắn tên hạng vé. Không dùng tọa độ hay mã ghế của Lavender để chọn vé Vương Bình.

Khi có link Hà Nội cần xác nhận lại bốn nhóm thông tin:

1. **Danh tính suất:** URL, calendarId, thành phố, địa điểm và ngày biểu diễn.
2. **Danh mục vé:** tên chính xác, giá, quyền lợi, giới hạn số lượng và điều kiện mua.
3. **Luồng chọn:** khu vực/số lượng, tự cấp ghế, chọn ghế hoặc kết hợp nhiều loại trong cùng event.
4. **Trạng thái phiên:** phòng chờ, xác minh, được vào chọn, thời gian còn lại, checkout hoặc hết hạn.

## 4. Những sửa đổi đã thực hiện từ khảo sát

- Parser giá chấp nhận ký hiệu tiền trước/sau số, gồm cả khi ký hiệu nằm ở một `span` riêng.
- Nhận cùng concert ở route `/events/` và `/booking/`; vẫn bắt buộc đúng slug và calendarId đã lưu. Link booking nhập vào được chuẩn hóa về event khi lưu cấu hình.
- Không coi nút chỉ xem mô tả hoặc sự kiện khác là điều khiển chọn vé.
- Bổ sung nhận diện câu hướng dẫn chọn vị trí chỗ ngồi; gặp canvas không đủ dữ liệu vẫn trả unsupported.
- Thêm fixture cấu trúc thẻ giới thiệu và test hồi quy; không giả lập fixture đó là DOM của trang chọn ghế đã xác minh.

Những sửa đổi ở lần khảo sát 0.1.0 chỉ cải thiện nhận diện. Từ 0.2.0 đã bổ sung executor chọn zone/một ghế DOM, số lượng và đi tới checkout; từ 0.3.0 có catalog API và preflight ID/giá. Chưa điều khiển zoom/tầng/canvas/iframe hoặc đọc đầy đủ đồng hồ giữ chỗ. Booking mục tiêu vẫn cần đối chiếu bằng phiên thật.

## 5. Phần cần quan sát tiếp

Phòng chờ thực tế và bước chọn vé sau đăng nhập vẫn thiếu bằng chứng. Code nhận diện phòng chờ tổng quát; nếu route không giữ danh tính event, panel giữ trạng thái phòng chờ kèm cảnh báo chưa xác nhận thuộc suất đã lưu và không gợi ý. Domain khác chưa có quyền content script.

Cần một lần quan sát đúng suất Hà Nội khi trang được công bố để thu được DOM của từng bước. Ưu tiên tạo fixture riêng cho: thẻ thông tin khác với vùng có thể chọn, lựa chọn số lượng, sơ đồ tương tác có nhãn, thời gian phiên còn lại và hết hạn. Không suy từ ảnh để tự click vào bản đồ.

Script khảo sát có thể chạy lại toàn bộ bằng `node scripts/inspect-public-cases.mjs`, hoặc một case cố định như `node scripts/inspect-public-cases.mjs lavender-booking`. Script chỉ mở URL công khai; báo cáo JSON/ảnh được lưu local và không được dùng làm cấu hình mua vé.
