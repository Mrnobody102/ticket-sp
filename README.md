# Camp vé · 1Zone Assistant

Chrome Extension MV3 chạy cục bộ: lưu concert, nhắc giờ, đọc trạng thái trang và đánh dấu hạng vé phù hợp. Mặc định **1 vé**, **không giới hạn ngân sách**, theo buổi thử ngày 18/10/2026. Bạn tự chọn vé, đăng nhập, xử lý phòng chờ/xác minh và thanh toán trên 1Zone. Nếu từng lưu số vé khác, nhập lại 1 rồi lưu; cập nhật extension không tự ghi đè lựa chọn đã lưu.

**Mục tiêu là suất Hà Nội của Vương Bình; chưa có URL suất Hà Nội được xác nhận.** Link TP.HCM và sự kiện Lavender tại Cung Thiếu nhi chỉ dùng tham khảo, không được tự dùng làm mục tiêu mua vé. Xem [khảo sát các case thực tế](docs/KHAO_SAT_1ZONE.md). Chưa xác nhận khả năng đọc hạng vé của đợt Hà Nội.

## Cài bản dùng thử

Sau khi clone repo, dùng Node.js 22.x và chạy tại thư mục project:

```powershell
npm ci
npm run build
```

1. Mở `chrome://extensions`, bật **Developer mode**.
2. Chọn **Load unpacked** → thư mục `.output/chrome-mv3` trong project (chứa `manifest.json`).
3. Ghim icon **Camp vé · 1Zone Assistant**.
4. Click icon → **Mở bản diễn tập**. Chuyển thử Chọn khu vực / Ghế tự cấp / Chọn ghế / Phòng chờ / Xác minh / Canvas. Không cần tài khoản thật.

Sau mỗi lần build: **Reload** tại `chrome://extensions`, rồi tải lại tab 1Zone để cập nhật content script.

Để chuyển bản build sang máy khác, chạy `npm run zip`, giải nén `.output/ticket-sp-0.1.0-chrome.zip` rồi Load unpacked thư mục đã giải nén. ZIP này là bản production; `.output/chrome-mv3-dev` dành cho phát triển. Git chỉ lưu source và lockfile; các bản build/ZIP được tạo lại bằng những lệnh trên.

## Khi có link fan meeting

1. Nhập link `/events/…` hoặc `/booking/…` trên `https://ticket.1zone.vn`; link booking được chuẩn hóa về trang event để lưu. Giữ đúng `calendarId` và kiểm tra suất Hà Nội.
2. Nhập **ngày giờ mở bán theo Việt Nam UTC+7**. Không lấy giờ biểu diễn làm giờ bán.
3. Chọn 1 hoặc 2 vé; để trống ngân sách. Hạng vé nhập đúng tên hiển thị, mỗi dòng một hạng, ưu tiên từ trên xuống. Để trống danh sách để xem tất cả.
4. **Lưu & bật theo dõi** → **Mở concert đã lưu**. Tiện ích ưu tiên dùng lại tab đúng concert, không refresh tab đó.
5. Panel góc trái hiển thị countdown, trạng thái và gợi ý. Khung xanh chỉ đánh dấu; bạn tự chọn trên website và kiểm tra phí/số vé còn lại.
6. **Dừng** ngừng gợi ý và hủy nhắc giờ. **Ẩn panel** chỉ ẩn giao diện; hiện lại bằng checkbox trong popup. Click tên Camp vé trên panel để thu gọn.

Ngân sách so với **giá hiển thị × số vé**, chưa cộng phí. Giá không rõ mà có ngân sách thì không gợi ý. Hạng vé mơ hồ/hết vé bị bỏ qua. Nút đang bật không chứng minh còn đủ số vé bạn muốn.

| Cách chọn chỗ | Tool hỗ trợ |
|---|---|
| Chỉ chọn khu vực | Gợi ý khu/hạng phù hợp; bạn chọn số lượng trên website |
| Website cấp ghế | Gợi ý hạng/khu; việc cấp ghế tuân theo quy định sự kiện, chưa khẳng định random hoặc liền nhau |
| Chọn ghế cụ thể | Gợi ý từng ghế có nhãn đọc được cho yêu cầu 1 vé; không coi một ghế là nhóm nhiều vé |
| Nhiều cách trong cùng event | Panel báo cần kiểm tra từng khu; không áp một cách chọn cho mọi khu |

Chưa hỗ trợ chọn ghế trên canvas/iframe thiếu nhãn, tối ưu ghế liền nhau hoặc tự click. Xem [đánh giá source và cơ chế tham khảo](docs/REVIEW_VA_NGUON_THAM_KHAO.md).

## Ba việc trước giờ mở bán

1. Có link và giờ chính thức: nhập cấu hình, kiểm tra đúng suất, cách chọn vé, giới hạn số lượng và tên hạng vé trên trang thật.
2. Diễn tập local và thử nhắc giờ gần trong tương lai; bật thông báo Chrome/Windows, đồng bộ đồng hồ máy, tắt sleep, giữ Chrome chạy.
3. Đăng nhập 1Zone thủ công, chuẩn bị thanh toán; dùng một tab concert/session và theo hướng dẫn phòng chờ của website.

## Phát triển và kiểm tra

Node.js 22.x; phiên bản khóa trong `package-lock.json`.

```powershell
npm ci
npm run dev
```

`dev` không tự mở trình duyệt; load `.output/chrome-mv3-dev`. Bản ngày bán dùng production:

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
npm run zip
```

`check` gồm typecheck, unit tests, build. Playwright dùng profile Chromium tạm, extension thật và URL fixture qua request interception; không tạo đơn hàng. `zip` tạo gói trong `.output`; Load unpacked vẫn chọn `.output/chrome-mv3`.

Xem [kết quả và giới hạn kiểm tra](docs/VALIDATION.md). Lệnh `npm run smoke:live -- https://ticket.1zone.vn/events/…` kiểm tra chỉ đọc trang công khai bằng profile tạm; không dùng tài khoản cá nhân. `node scripts/inspect-public-cases.mjs` khảo sát danh sách trang tham khảo đã cố định, không click website hay tạo đơn.

## Source

```text
src/
  entrypoints/       # popup, content script, background, demo
  core/              # model, validation, timezone, gợi ý thuần
  platforms/         # 1Zone; Ticketbox/CTicket trả unsupported
  infrastructure/    # Chrome storage, messages, alarms, notifications
  ui/                # React, observer, highlight trong Shadow DOM
  testing/           # danh mục fixture dùng trong demo
fixtures/            # HTML mô phỏng ba dạng vé và trạng thái chặn/lỗi
tests/unit/
tests/e2e/
docs/
```

Core không import Chrome/React. Adapter chỉ đọc DOM; overlay không sửa/chọn điều khiển của 1Zone. Dữ liệu bền ở `chrome.storage.local`; ghi cấu hình tuần tự qua background worker. DOM observer được throttle; không polling mạng/tự refresh. Alarm được khôi phục khi worker khởi động; dấu đã nhắc lưu bền.

## Giới hạn

- Chỉ quyền host `https://ticket.1zone.vn/*`; không đọc cookies, shop/vote/domain khác. Thanh toán chuyển host nằm ngoài phạm vi tiện ích.
- Nhận diện theo nhãn/giá/điều khiển nhìn thấy. Chưa có selector xác minh cho fan meeting mục tiêu; DOM khác mẫu có thể trả `UNKNOWN`.
- Canvas/iframe thiếu dữ liệu ghế rõ ràng trả `UNSUPPORTED_VARIANT`; thao tác trực tiếp. Không quy đổi tọa độ thành ghế.
- Phòng chờ, CAPTCHA, checkout, sai concert hoặc vượt giới hạn số vé: không highlight.
- Một cấu hình concert cho mọi tab phù hợp; không phối hợp giữ vé giữa các tab. Nên dùng một tab thao tác.
- Countdown theo đồng hồ máy, không đồng bộ server và không xác nhận đã mở bán. Alarm có thể trễ khi browser/OS bận hoặc sleep. Nhắc bù tối đa 15 phút; mốc cũ hơn bị bỏ qua. Giữ Chrome mở.
- Không tự click, điền số lượng, giữ vé, tạo đơn/thanh toán; không bảo đảm có vé. Chưa hỗ trợ Ticketbox, CTicket hay thương mại.
- Không telemetry/backend/log DOM/tài khoản/thanh toán. Chỉ lưu URL bỏ tracking, giờ bán và sở thích mua vé trên máy.

## Xử lý sự cố

- **Không thấy panel:** reload tab sau khi cài/cập nhật, kiểm tra host, quyền truy cập trang và checkbox hiển thị trong popup.
- **Sai sự kiện:** kiểm tra slug và `calendarId`. Route checkout không giữ danh tính có thể báo chưa khớp; thao tác trực tiếp.
- **Thiếu gợi ý:** kiểm tra tên hạng chính xác, ngân sách tổng và số lượng. Website có thể chưa mở bước chọn hoặc chỉ có canvas. Không suy luận hết vé từ thiếu gợi ý.
- **Thiếu thông báo:** kiểm tra Windows/Chrome, thử mốc mới trong tương lai. Cùng URL + cùng giờ đã nhắc sẽ không lặp khi dừng/bật lại.
- **Extension context invalidated:** tải lại tab sau khi reload extension.

## Nguồn đối chiếu ngày 17/10/2026

[1Zone](https://1zone.vn/), [chọn khu vực](https://ticket.1zone.vn/events/ngay-em-den), [chọn chỗ](https://ticket.1zone.vn/events/yeu-nguoi-co-uoc-mo-12882?calendarId=2InwCp), [ghế tự cấp](https://ticket.1zone.vn/events/tram-yeu-5). Event mẫu không phải bằng chứng có sale 18/10.

[Điều khoản](https://doc.1zone.vn/vi/policy/terms-of-use/) có hạn chế đối với công cụ truy cập tự động và mục đích thương mại/bên thứ ba; đọc được trang không chứng minh quyền tích hợp. Xem thêm [giới hạn theo sự kiện](https://doc.1zone.vn/vi/policy/supply-conditions/) và [cung cấp dịch vụ](https://doc.1zone.vn/vi/policy/service-delivery/). Bản này hỗ trợ diễn tập và thao tác thủ công; chưa xác nhận quyền tích hợp/triển khai kinh doanh.
