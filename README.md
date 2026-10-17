# Camp vé · Ticket Assistant

Chrome Extension MV3 chạy cục bộ, mặc định **1 vé**, ngân sách không giới hạn. Bản **0.2.0** bổ sung camp tự động: **vào bước mua → chọn zone/ghế theo ưu tiên → đặt số lượng → bấm tiếp → dừng tại checkout**. Nhắc giờ và highlight vẫn có sẵn để theo dõi.

Hiện có adapter **1Zone**. Core, bộ điều phối và hợp đồng adapter dùng chung; Ticketbox/CTicket chưa được tích hợp. Mục tiêu là Vương Bình **Hà Nội**, URL/giờ mở bán chưa được xác nhận. Link TP.HCM và bản đồ sự kiện khác chỉ là tham khảo: [khảo sát](docs/KHAO_SAT_1ZONE.md).

## Cài đặt

Node.js 22.x, chạy tại thư mục project:

```powershell
npm ci
npm run build
```

1. Mở `chrome://extensions`, bật **Developer mode**.
2. **Load unpacked** → `.output/chrome-mv3` trong project.
3. Ghim icon **Camp vé**. Sau mỗi lần build/reload extension, tải lại tab website.
4. **Mở bản diễn tập** → **Camp tự động tới checkout** → **Bắt đầu camp** trong panel để xem luồng chạy cục bộ.

`npm run zip` tạo `.output/ticket-sp-0.2.0-chrome.zip`. Chuyển sang máy khác thì giải nén và Load unpacked thư mục chứa manifest. Git chỉ lưu source/lockfile, không lưu output hay dữ liệu test.

## Sử dụng

1. Đăng nhập 1Zone trước. Nhập đúng link concert/suất, giờ bán **UTC+7**, số vé và hạng vé ưu tiên, mỗi dòng một hạng.
2. **Lưu & bật theo dõi** chỉ lưu cấu hình và bật bộ đọc/nhắc giờ.
3. **Bắt đầu camp** trong popup mở/dùng lại một tab đúng concert. Hoặc bấm nút này ngay trên panel của tab concert.
4. Tool chờ giờ bán theo đồng hồ máy và nút mua khả dụng. Khi được vào chọn vé, tool tự thao tác trên điều khiển đọc được.
5. Panel báo từng bước và kết quả. Khi tới checkout, bạn kiểm tra vé, phí và thanh toán.

Camp chỉ dùng **cấu hình đã lưu**. Lưu lại cấu hình dừng phiên hiện tại. Một phiên sở hữu một tab; tab khác không thực thi. **Dừng camp** hủy phiên thao tác; **Dừng theo dõi** hủy cả camp và nhắc giờ. **Ẩn panel** chỉ ẩn UI, camp vẫn chạy; dừng bằng popup nếu cần.

Phiên camp tồn tại trong `chrome.storage.session`, qua lần worker khởi động lại/điều hướng tab, nhưng không tự bật lại sau khi đóng/mở Chrome hoặc reload extension. Đóng tab chủ sẽ hủy phiên. Phiên hết hạn sau một giờ tính từ mốc muộn hơn giữa lúc bắt đầu và giờ bán.

| Giao diện | Tự động hóa hiện tại |
|---|---|
| Chọn khu vực / website cấp ghế | Chọn ưu tiên còn khả dụng, xác nhận đã chọn, đặt số lượng qua input/select/stepper có nhãn, đi tiếp |
| Chọn ghế DOM có nhãn và giá | Chọn một ghế cho yêu cầu 1 vé, xác nhận đã chọn rồi đi tiếp |
| Nhiều ghế / khu có cách chọn lẫn nhau | Chưa tự ghép nhóm ghế; dừng nếu không xác định được cách chọn |
| Phòng chờ | Giữ tab, chờ website cho vào rồi tiếp tục khi đúng concert |
| CAPTCHA / đăng nhập / lỗi giữ chỗ | Tạm dừng, hiển thị lý do; xử lý trên website rồi bắt đầu lại |
| Canvas/iframe không có dữ liệu đọc được | Dừng; chưa có adapter thao tác map này |

Ưu tiên khớp tên chính xác sau khi bỏ dấu/chuẩn hóa chữ. Hạng hết vé bị bỏ qua; hạng khác chỉ được chọn theo cấu hình fallback. Ngân sách xét **giá hiển thị × số vé**, chưa cộng phí. Tool không biết tồn kho server trước khi website phản hồi.

## Tốc độ và xác nhận thao tác

Khi camp chạy, mutation/input/change của website kích hoạt lượt đọc với độ trễ gom lịch mục tiêu **16 ms**, thay cho khoảng 600 ms ở chế độ theo dõi. Đây không phải cam kết mua được vé trong 16 ms.

Mỗi hành động được ghi trạng thái trước khi bấm, kiểm tra lại DOM sau bước ghi bất đồng bộ và chờ website xác nhận. Không tự bấm lại một lệnh chưa rõ kết quả. Nhịp thực tế còn phụ thuộc Chrome, DOM, phòng chờ, mạng và server. Panel hiển thị thời gian từ bắt đầu chọn vé tới lúc nhận diện checkout của phiên đó.

Bản diễn tập có tương tác dùng cùng core/runner/adapter. Kết quả fixture không chứng nhận tốc độ hoặc tương thích với sale thật. Chưa có DOM bước mua của suất Hà Nội; cần đối chiếu adapter khi có giao diện này.

## Kiểm tra

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
npm run zip
```

`check` gồm typecheck, unit tests, build production. E2E chạy extension thật trên Chromium với website mô phỏng, không tạo đơn thật. `npm run dev` dùng `.output/chrome-mv3-dev`, không dùng bản này cho buổi bán.

`npm run smoke:live -- https://ticket.1zone.vn/events/…` và `node scripts/inspect-public-cases.mjs` vẫn chỉ đọc trang công khai, không khởi động camp hay đặt vé.

## Cấu trúc và mở rộng

```text
src/core/            # dữ liệu, URL policy, validation, ranking, máy trạng thái thuần
src/application/     # runner, scheduling và hợp đồng transport
src/platforms/       # BrowserPlatformAdapter, registry, bộ đọc/thao tác 1Zone
src/infrastructure/  # Chrome storage, session/CAS, messages, tab, nhắc giờ
src/entrypoints/     # khởi chạy background/content/popup/demo
src/ui/              # cấu hình, panel, observer, overlay
src/testing/         # fixtures và hành vi mô phỏng cục bộ
tests/unit/          # quyết định, DOM, phiên, chống thao tác cũ
tests/e2e/           # extension production và luồng tự tới checkout
```

Để thêm nền tảng: khai báo URL policy trong catalog, viết adapter theo contract, đăng ký vào registry và bổ sung fixtures/E2E. Manifest và content matches lấy cùng catalog. Core/runner không chứa selector hoặc thao tác đặc thù 1Zone. Chưa thêm domain/quyền của nền tảng chưa tích hợp.

Chi tiết: [cơ chế hoạt động](docs/CO_CHE_HOAT_DONG.md), [kết quả kiểm tra](docs/VALIDATION.md), [review và nguồn](docs/REVIEW_VA_NGUON_THAM_KHAO.md).

## Giới hạn thực tế

- Chỉ thao tác qua DOM website; một số website không nhận synthetic click/input hoặc không khai báo trạng thái chọn, cần adapter tương ứng.
- Chưa có bộ đọc đầy đủ đồng hồ giữ chỗ. Có dừng với một số thông báo hết hạn/lỗi rõ ràng, không bảo đảm phát hiện mọi trường hợp.
- Chưa tự refresh/poll tồn kho, giải CAPTCHA, thay tài khoản hay vượt phòng chờ.
- Không bấm nút thanh toán cuối; không đọc/lưu mật khẩu hoặc thông tin thẻ.
- Giữ Chrome mở, máy thức và đồng hồ đúng. Trang thanh toán chuyển host ngoài quyền sẽ cần thao tác trực tiếp.
- Điều khoản 1Zone và quyền tích hợp/thương mại vẫn cần được đối chiếu riêng; xem các nguồn trong tài liệu khảo sát.
