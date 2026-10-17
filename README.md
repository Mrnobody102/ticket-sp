# Camp vé · Ticket Assistant

Chrome Extension MV3 chạy cục bộ, mặc định **1 vé**, ngân sách không giới hạn. Bản **0.4.1** sửa nhãn sự kiện, kiểm tra giao diện/worker cùng phiên bản, mở trang cấu hình trực tiếp và dùng danh sách hạng từ API làm luồng mặc định. Luồng chính: **tìm sự kiện → lấy suất/hạng/giá → chọn ưu tiên → chuẩn bị trước giờ bán → tự chọn và đi tới checkout**. Nhắc giờ là phần phụ.

**1Zone** có nguồn dữ liệu và adapter camp; **Ticketbox** chỉ tra cứu; **CTicket** chưa kết nối. Preset [Vương Bình Hà Nội](https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm) đặt **12:00 ngày 19/10/2026 UTC+7**, theo thời gian người dùng xác nhận. Trang hiện chưa mở bán; booking thật chưa được xác minh. Xem [chuẩn bị và cách test](docs/SAN_SANG_MO_BAN.md).

## Cài đặt

Node.js 22.x, chạy tại thư mục project:

```powershell
npm ci
npm run build
```

1. Mở `chrome://extensions`, bật **Developer mode**.
2. **Load unpacked** → `.output/chrome-mv3` trong project.
3. Ghim icon **Camp vé**. Sau mỗi lần build/reload extension, tải lại tab website.
4. **Diễn tập** → **Camp tự động tới checkout** → **Bắt đầu camp** trong panel để xem luồng chạy cục bộ.

`npm run zip` tạo `.output/ticket-sp-0.4.1-chrome.zip`. Chuyển sang máy khác thì giải nén và Load unpacked thư mục chứa manifest. Git chỉ lưu source/lockfile, không lưu output hay dữ liệu test.

### Cập nhật khi đang nạp `.output/chrome-mv3`

Build mới chỉ thay file trên đĩa; Chrome có thể vẫn chạy tiến trình nền cũ. Sau build:

1. Đóng popup và tab cấu hình cũ. Mở `chrome://extensions`.
2. Ở **Camp vé · 1Zone Assistant**, bấm biểu tượng **Tải lại / Reload**.
3. Mở lại tiện ích, kiểm tra nhãn **v0.4.1**, rồi tải lại tab 1Zone.

Không cần tải ZIP nếu Chrome đang nạp trực tiếp `.output/chrome-mv3` của project này. Nếu nạp thư mục giải nén ZIP ở nơi khác, cập nhật đầy đủ các file trong chính thư mục đó rồi Reload.

Thông báo **Cần tải lại tiện ích** cho biết kiểm tra giao diện/worker không thành công; nó thay lỗi chung “Lệnh không được hỗ trợ”. Nút **Mở rộng ↗** và **Diễn tập** là link trực tiếp tới trang extension, không đi qua lệnh nền. Kiểm tra phiên bản chỉ chạy khi mở cấu hình, không chen vào từng hành động đặt vé.

## Sử dụng

1. Đăng nhập 1Zone trước. Mở tiện ích; **Mở rộng ↗** mở cửa sổ cấu hình rộng hơn. Tìm tên sự kiện hoặc nhập link và bấm **Tải chi tiết từ link**.
2. Chọn đúng ngày/địa điểm, thêm hạng vé theo thứ tự ưu tiên bằng select. Giá lấy từ nguồn. Nhập giờ bán **UTC+7** theo ban tổ chức; mặc định 1 vé. Nếu tải lỗi, thử lại bằng **Tải hạng vé**. Nhập thủ công chỉ xuất hiện khi chủ động bật trong **Tùy chọn thêm**.
3. **Lưu & bật theo dõi**, rồi **Bắt đầu camp**. Tool đọc mới catalog để đối chiếu suất/hạng/giá trước khi mở/dùng lại tab concert. Cũng có thể bắt đầu trên panel.
4. Tool chờ giờ bán theo đồng hồ máy và nút mua khả dụng. Khi được vào chọn vé, tool tự thao tác trên điều khiển đọc được.
5. Panel báo từng bước và kết quả. Khi tới checkout, bạn kiểm tra vé, phí và thanh toán.

Với suất đã chốt, chọn thẻ **TIỆC THÀNH-THÂN (MÂM 2): VƯƠNG BÌNH 💘 VOI CON**, bên dưới có nhãn **Chuẩn bị sự kiện →**, để tự điền link, giờ và 1 vé, tự tải hạng/giá. Bạn chọn và sắp thứ tự hạng trước, sửa số vé hoặc giờ bán nếu cần. Số vé bị giới hạn theo suất và các hạng đã chọn; khi chưa có giới hạn từ nguồn, tool không khẳng định giới hạn của website. Ngân sách/fallback nằm trong **Tùy chọn thêm**. Lưu rồi bật camp **trước 12h** để preflight hoàn tất trước mốc chạy. Preset không tự lưu, tự chọn hạng hoặc tự bật camp. Show khác dùng cùng luồng tìm/dán link và cấu hình, không phụ thuộc preset Hà Nội.

Camp chỉ dùng **cấu hình đã lưu**; nút bắt đầu bị khóa khi form có thay đổi chưa lưu. Lưu lại cấu hình dừng phiên hiện tại. Một phiên sở hữu một tab; tab khác không thực thi. **Dừng camp** hủy phiên thao tác; **Dừng theo dõi** hủy cả camp và nhắc giờ. **Ẩn panel** chỉ ẩn UI, camp vẫn chạy; dừng bằng popup nếu cần.

Phiên camp tồn tại trong `chrome.storage.session`, qua lần worker khởi động lại/điều hướng tab, nhưng không tự bật lại sau khi đóng/mở Chrome hoặc reload extension. Đóng tab chủ sẽ hủy phiên. Phiên hết hạn sau một giờ tính từ mốc muộn hơn giữa lúc bắt đầu và giờ bán.

| Giao diện | Tự động hóa hiện tại |
|---|---|
| Chọn khu vực / website cấp ghế | Chọn ưu tiên còn khả dụng, xác nhận đã chọn, đặt số lượng qua input/select/stepper có nhãn hoặc modal 1Zone có dấu hiệu đã đối chiếu, đi tiếp |
| Chọn ghế DOM có nhãn và giá | Chọn một ghế cho yêu cầu 1 vé, xác nhận đã chọn rồi đi tiếp |
| Nhiều ghế / khu có cách chọn lẫn nhau | Chưa tự ghép nhóm ghế; dừng nếu không xác định được cách chọn |
| Phòng chờ | Giữ tab, chờ website cho vào rồi tiếp tục khi đúng concert |
| CAPTCHA / đăng nhập / lỗi giữ chỗ | Tạm dừng, hiển thị lý do; xử lý trên website rồi bắt đầu lại |
| Canvas/iframe không có dữ liệu đọc được | Dừng; chưa có adapter thao tác map này |

Ưu tiên dùng ID hạng nếu DOM cung cấp; nếu thiếu ID thì khớp tên chính xác sau chuẩn hóa. Cấu hình từ API còn yêu cầu giá trên DOM khớp giá đã chọn. Hạng hết vé bị bỏ qua; hạng khác chỉ được chọn khi bật phương án thay thế. Ngân sách xét **giá hiển thị × số vé**, chưa cộng phí. Catalog không bảo đảm tồn kho hoặc giữ vé thành công.

## Tốc độ và xác nhận thao tác

Khi camp chạy, mutation/input/change kích hoạt lượt đọc ở microtask tiếp theo, bỏ khoảng gom 16 ms cũ. Lịch camp ưu tiên hơn timer theo dõi khoảng 600 ms. Quyết định bắt đầu trước phần vẽ panel; vẫn ghi bước, kiểm tra lại DOM và xác nhận phản hồi.

Preset cho tải lại **một lần** tại giờ bán nếu đúng trang vẫn NOT_READY; không tải lại queue/CAPTCHA/phiên đang chọn. Nếu CTA đã mở thì dùng ngay, không reload. Dấu reload được lưu qua điều hướng; không lặp refresh.

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

`npm run bench:camp` đo 24 mẫu với extension production và website/API mô phỏng. Báo cáo p50/p95 ở `artifacts/camp-benchmark.json`. **Diễn tập → 1Zone · Modal hạng vé** cho thử trực tiếp bằng UI. `node scripts/smoke-target.mjs` chỉ đo nhận diện trên trang Hà Nội công khai bằng profile tạm, không khởi động camp/giữ vé. Kết quả fixture không chứng minh nhanh nhất hoặc mua được vé thật.

`npm run smoke:live -- https://ticket.1zone.vn/events/…`, `node scripts/inspect-public-cases.mjs` và `npm run smoke:catalog` chỉ đọc trang/API công khai. Smoke catalog chạy UI thật với profile tạm, không lưu cấu hình hay khởi động camp.

## Cấu trúc và mở rộng

```text
src/core/            # dữ liệu, URL policy, validation, ranking, máy trạng thái thuần
src/application/     # runner, scheduling và hợp đồng transport
src/platforms/       # CatalogProvider 1Zone/Ticketbox; BrowserPlatformAdapter 1Zone
src/infrastructure/  # GET transport/cache, Chrome storage, session/CAS, messages, tab
src/entrypoints/     # background/content/popup/workspace/demo
src/ui/              # cấu hình, panel, observer, overlay
src/testing/         # fixtures và hành vi mô phỏng cục bộ
tests/unit/          # quyết định, DOM, phiên, chống thao tác cũ
tests/e2e/           # extension production và luồng tự tới checkout
```

Nguồn dữ liệu (`CatalogProvider`) và bộ mua vé (`BrowserPlatformAdapter`) là hai contract riêng. Có thể thêm tra cứu mà chưa bật camp. Để bật camp nền tảng mới: khảo sát booking, khai báo URL policy, viết/đăng ký adapter và bổ sung fixtures/E2E. Core/runner không chứa selector riêng của 1Zone.

Quyền đọc host: `ticket.1zone.vn`, `marketplace.1zone.vn`, `prod.1zone.vn`, `api-v2.ticketbox.vn`. Content script chỉ chạy trên `ticket.1zone.vn`. Catalog GET không gửi cookie/token; session đăng nhập vẫn do website quản lý.

Chi tiết: [cơ chế hoạt động](docs/CO_CHE_HOAT_DONG.md), [kết quả kiểm tra](docs/VALIDATION.md), [review và nguồn](docs/REVIEW_VA_NGUON_THAM_KHAO.md).

## Giới hạn thực tế

- Chỉ thao tác qua DOM website; một số website không nhận synthetic click/input hoặc không khai báo trạng thái chọn, cần adapter tương ứng.
- Chưa có bộ đọc đầy đủ đồng hồ giữ chỗ. Có dừng với một số thông báo hết hạn/lỗi rõ ràng, không bảo đảm phát hiện mọi trường hợp.
- Chưa tự refresh/poll tồn kho, giải CAPTCHA, thay tài khoản hay vượt phòng chờ.
- Không bấm nút thanh toán cuối; không đọc/lưu mật khẩu hoặc thông tin thẻ.
- Giữ Chrome mở, máy thức và đồng hồ đúng. Trang thanh toán chuyển host ngoài quyền sẽ cần thao tác trực tiếp.
- Điều khoản 1Zone và quyền tích hợp/thương mại vẫn cần được đối chiếu riêng; xem các nguồn trong tài liệu khảo sát.
