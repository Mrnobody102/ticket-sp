# Camp vé · Ticket Assistant

Chrome Extension MV3 trên máy tính, mặc định **1 vé**, ngân sách không giới hạn. Luồng chính: **tìm sự kiện → chọn suất/hạng → đặt số vé/giờ → lưu → bắt đầu camp**. Đích là tới checkout đúng vé; người dùng kiểm tra đơn và thanh toán cuối.

Adapter đối chiếu tên/ID/giá, khu trong modal, số lượng và lựa chọn đã được website xác nhận. Dữ liệu mâu thuẫn hoặc renderer chưa hỗ trợ thì dừng. `snapshot.state` là trạng thái nội bộ, không phải text nguyên văn trên website.

**0.6.3** khởi tạo theo DOM, không chờ ảnh; lần cập nhật đúng mốc bán không bị nhịp F5 trước đó đẩy muộn. App giữ máy không tự ngủ và tab khỏi tự discard khi camp, chuẩn bị foreground trước giờ bán; nếu Chrome thay tab ID thì tự chuyển quyền, giữ nguyên tiến trình. Các bảo vệ chạy riêng, không thêm request vào từng bước chọn vé.

Chế độ **Theo giờ và khi web mở** tải mới trang còn khóa từ 2 phút trước giờ bán, mỗi giây trong phút cuối; mua ngay khi CTA đã xác minh mở. Không F5 queue/chọn vé/giữ chỗ. Khu vừa hết vé trước giữ chỗ được thử lại đúng ưu tiên; kết quả giữ vé tới muộn vẫn được nhận và không gửi lặp. [Tiêu chí hiệu quả và phục hồi tự động](docs/RUI_RO_VA_KIEM_THU.md).

Đóng popup vẫn camp. App dùng quyền `power` giữ hệ thống hoạt động khi camp, trả lại chính sách tab và thả chống ngủ khi dừng/checkout/hết phiên. Không hỗ trợ Chrome điện thoại. Phiên hết hạn một giờ sau mốc muộn hơn giữa lúc bật và giờ bán. Xem [chuẩn bị trước giờ bán](docs/SAN_SANG_MO_BAN.md).

**1Zone** có nguồn dữ liệu và adapter camp; **Ticketbox** chỉ tra cứu; **CTicket** chưa kết nối. Preset [Vương Bình Hà Nội](https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm) chuẩn bị HAI QUÝ và 1 vé. Giờ bán lượt tiếp theo do người dùng cập nhật; không điền lại giờ đã qua. Ticketbox đã khảo sát API từng suất và luồng đăng nhập, chưa bật tự đặt vé; xem [kết quả nghiên cứu](docs/TICKETBOX.md). Xem [chuẩn bị và cách test](docs/SAN_SANG_MO_BAN.md).

## Cài bản gửi bạn bè

Nhận **`Camp-ve-0.6.3.zip`**, giải nén và mở **`BAT-DAU.html`**. Trong Chrome → `chrome://extensions` → Developer mode → Load unpacked, chọn thư mục **`tien-ich`**. Không cần source, Node.js hoặc npm. Mỗi người tự đăng nhập website trên Chrome của mình.

Bản gửi bạn bè nằm ở `.output/Camp-ve-0.6.3.zip`. `.output/chrome-mv3` đã được cập nhật bằng đúng 16 file production đã kiểm thử ở `artifacts/release-0.6.3`; bản trước được sao lưu trong artifacts. Dừng phiên cũ, Reload tiện ích rồi tải lại tab sự kiện trước lượt mới; không cần nạp thêm tiện ích trùng.

Mở tool → **Diễn tập** → chọn số vé → **Chạy thử**. Kết quả cần thấy: **Đã tới thanh toán** và đúng số vé. **Làm lại** đặt lại bài thử; các màn queue/CAPTCHA/canvas nằm trong phần kiểm tra riêng.

Kênh cài qua link là Chrome Web Store **Private** cho nhóm bạn, sau đó mới triển khai tài khoản/cấp quyền nếu kinh doanh. Hiện chưa đăng Store hoặc có backend khóa chia sẻ. Xem [phát hành và quyền dùng](docs/PHAT_HANH.md).

## Phát triển source

Node.js 22.x, chạy tại thư mục project:

```powershell
npm ci
npm run build
```

1. Mở `chrome://extensions`, bật **Developer mode**.
2. **Load unpacked** → `.output/chrome-mv3` trong project.
3. Ghim icon **Camp vé**. Sau mỗi lần build/reload extension, tải lại tab website.
4. **Diễn tập** → chọn số vé → **Chạy thử**.

`npm run zip` tạo `.output/ticket-sp-0.6.3-chrome.zip`. Git chỉ lưu source/lockfile, không lưu output hay dữ liệu test.

### Tạo bản phát hành · dành cho người phát triển

```powershell
npm run release
```

Hoặc chạy workflow **Build tested extension** trong GitHub Actions. Đầu ra gồm **`.output/Camp-ve-0.6.3.zip`** để gửi, ZIP riêng để upload Web Store, `SHA256SUMS.txt` và `release.json`. Không gửi repo hoặc yêu cầu người nhận chạy lệnh build. Hướng dẫn cũng có trong menu tool. [Nội dung chuẩn bị Web Store](docs/WEB_STORE.md).

### Cập nhật khi đang nạp `.output/chrome-mv3`

Build mới chỉ thay file trên đĩa; Chrome có thể vẫn chạy tiến trình nền cũ. Sau build:

1. Đóng popup và tab cấu hình cũ. Mở `chrome://extensions`.
2. Ở **Camp vé · 1Zone Assistant**, bấm biểu tượng **Tải lại / Reload**.
3. **Tải lại tab 1Zone** để thay content script cũ. Mở lại tiện ích, kiểm tra **v0.6.3** ở cửa sổ cấu hình và bảng camp trên tab vé.
4. Tải lại hạng vé, chọn ưu tiên và lưu lại để nhận đầy đủ các khu của từng hạng. Bản cũ chỉ lưu một tên khu đại diện.

Không cần tải ZIP nếu Chrome đang nạp trực tiếp `.output/chrome-mv3` của project này. Nếu nạp thư mục giải nén ZIP ở nơi khác, cập nhật đầy đủ các file trong chính thư mục đó rồi Reload.

Thông báo **Cần tải lại tiện ích** cho biết kiểm tra giao diện/worker không thành công. Nút **Mở rộng ↗** và **Diễn tập** là link trực tiếp tới trang extension. Kiểm tra phiên bản chỉ chạy khi mở cấu hình hoặc khởi tạo tab, không chen vào từng hành động đặt vé. Chrome có thể giữ lỗi lịch sử; Xóa tất cả rồi tải lại tab để phân biệt lỗi mới.

## Sử dụng

1. Đăng nhập 1Zone trước. Mở tiện ích; **Mở rộng ↗** mở cửa sổ cấu hình rộng hơn. Tìm tên sự kiện hoặc dán link bán vé ngay vào ô tìm.
2. Chọn đúng suất, chọn hạng bằng danh sách; mỗi lần chọn tự thêm vào ưu tiên. Dùng ↑ ↓ để sắp thứ tự. Đặt số vé và giờ bán **UTC+7**; mặc định 1 vé. Nếu tải lỗi, thử lại bằng **Tải hạng vé**. Nhập thủ công chỉ xuất hiện khi chủ động bật trong **Ngân sách và cách chọn vé**.
3. **Lưu cấu hình**, rồi **Bắt đầu camp** ở thanh cuối cửa sổ. Tool đọc mới catalog để đối chiếu suất/hạng/giá trước khi mở/dùng lại tab concert. Cũng có thể bắt đầu trên panel.
4. Tool chờ giờ bán theo đồng hồ máy và nút mua khả dụng. Khi được vào chọn vé, tool tự thao tác trên điều khiển đọc được.
5. Panel báo từng bước và kết quả. Khi tới checkout, bạn kiểm tra vé, phí và thanh toán.

Với suất đã chốt, chọn thẻ **TIỆC THÀNH-THÂN (MÂM 2): VƯƠNG BÌNH 💘 VOI CON**, bên dưới có nhãn **Chuẩn bị sự kiện →**, để tự điền link, giờ và 1 vé, tự tải hạng/giá. Bạn chọn và sắp thứ tự hạng trước, sửa số vé hoặc giờ bán nếu cần. Số vé bị giới hạn theo suất và các hạng đã chọn; khi chưa có giới hạn từ nguồn, tool không khẳng định giới hạn của website. Ngân sách/fallback nằm trong **Ngân sách và cách chọn vé**. Lưu rồi bật camp **trước 12h** để preflight hoàn tất trước mốc chạy. Preset không tự lưu, tự chọn hạng hoặc tự bật camp. Show khác dùng cùng luồng tìm/dán link và cấu hình, không phụ thuộc preset Hà Nội.

Camp chỉ dùng **cấu hình đã lưu**; nút bắt đầu bị khóa khi form có thay đổi chưa lưu. Lưu lại cấu hình dừng phiên hiện tại, nhưng bị chặn khi giữ vé chưa rõ kết quả; lúc đó dùng **Kiểm tra tab vé**. Một phiên sở hữu một tab; tab khác không thực thi. **Dừng camp** hủy phiên thao tác; **Tắt công cụ trên trang vé** hủy cả camp và nhắc giờ. Các lệnh dừng không hủy đơn trên website. Ẩn bảng camp chỉ ẩn UI, camp vẫn chạy; dừng bằng popup nếu cần.

Phiên camp tồn tại trong `chrome.storage.session`, qua lần worker khởi động lại/điều hướng tab, nhưng không tự bật lại sau khi đóng/mở Chrome hoặc reload extension. Đóng tab chủ sẽ hủy phiên. Phiên hết hạn sau một giờ tính từ mốc muộn hơn giữa lúc bắt đầu và giờ bán.

| Giao diện | Tự động hóa hiện tại |
|---|---|
| Chọn khu vực / website cấp ghế | Chọn ưu tiên còn khả dụng, xác nhận đã chọn, đặt số lượng qua input/select/stepper có nhãn hoặc modal 1Zone có dấu hiệu đã đối chiếu, đi tiếp |
| Chọn ghế DOM có nhãn và giá | Chọn một ghế cho yêu cầu 1 vé, xác nhận đã chọn rồi đi tiếp |
| Nhiều ghế / khu có cách chọn lẫn nhau | Chưa tự ghép nhóm ghế; dừng nếu không xác định được cách chọn |
| Phòng chờ | Giữ tab, chờ website cho vào rồi tiếp tục khi đúng concert |
| CAPTCHA / đăng nhập / lỗi giữ chỗ | Xác minh tại queue/modal đã biết giữ phiên để tiếp tục; đăng nhập và trường hợp khác cần xử lý trực tiếp. Giữ vé chưa rõ kết quả không tự gửi lại |
| Canvas/iframe không có dữ liệu đọc được | Dừng; chưa có adapter thao tác map này |

Ưu tiên dùng ID hạng nếu DOM cung cấp; nếu thiếu thì khớp chính xác `name` hoặc `zoneName` từ cùng bản ghi API, kèm giá. Ví dụ HAI QUÝ - EB có thể hiển thị HAI QUÝ 2 trên booking. Alias trùng nhiều ID không được tự phân biệt bằng tên. Ảnh cần alt/ARIA hoặc điều khiển có nhãn; SVG cần role, title/ARIA và giá. Không suy ra lựa chọn từ màu hay tọa độ. Hạng hết vé bị bỏ qua. Ngân sách xét **giá hiển thị × số vé**, chưa cộng phí.

## Tốc độ và xác nhận thao tác

Khi camp chạy, mutation/input/change kích hoạt lượt đọc ở microtask tiếp theo, bỏ khoảng gom 16 ms cũ. Lịch camp ưu tiên hơn timer theo dõi khoảng 600 ms. Quyết định bắt đầu trước phần vẽ panel; vẫn ghi bước, kiểm tra lại DOM và xác nhận phản hồi.

Chế độ theo web tải mới trạng thái NOT_READY từ 2 phút trước giờ hẹn, mỗi giây trong phút cuối khi trang đã tải xong, giảm nhịp khi bán trễ. Không tải lại queue/CAPTCHA/phiên đang chọn. Nếu CTA đã mở thì dùng ngay; kiểm tra lại trước reload để không cắt ngang chuyển bước.

Mỗi hành động được ghi trạng thái trước khi bấm, kiểm tra lại DOM sau bước ghi bất đồng bộ và chờ website xác nhận. Không tự bấm lại một lệnh chưa rõ kết quả. Nhịp thực tế còn phụ thuộc Chrome, DOM, phòng chờ, mạng và server. Panel hiển thị thời gian từ bắt đầu chọn vé tới lúc nhận diện checkout của phiên đó.

Bản diễn tập có tương tác dùng cùng core/runner/adapter. Kết quả fixture không chứng nhận tốc độ hoặc tương thích với sale thật. Adapter đã đối chiếu dữ liệu sơ đồ và modal 1Zone; chưa kiểm chứng checkout đã đăng nhập của suất Hà Nội bằng tài khoản người dùng.

## Kiểm tra

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
npm run zip
```

`check` gồm typecheck, unit tests, build production. E2E chạy extension thật trên Chromium với website mô phỏng, không tạo đơn thật. `npm run dev` dùng `.output/chrome-mv3-dev`, không dùng bản này cho buổi bán.

`npm run bench:camp` đo phản ứng DOM/Konva và toàn luồng trang cũ → F5 → queue → đúng vé → checkout. Các báo cáo `artifacts/{camp,map,entry}-benchmark.json` ghi p50/p95, lựa chọn và số lần giữ vé của fixture. **Diễn tập → Chạy thử** để thử bằng UI. `node scripts/smoke-target.mjs` chỉ đọc trang Hà Nội công khai, không khởi động camp/giữ vé. Kết quả fixture không chứng minh nhanh nhất hoặc mua được vé thật.

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

Quyền đọc host: `ticket.1zone.vn`, `queue.1zone.vn`, `marketplace.1zone.vn`, `prod.1zone.vn`, `api-v2.ticketbox.vn`. Content script chạy trên `ticket.1zone.vn` và `queue.1zone.vn`; bridge sơ đồ chỉ trên host bán vé. Catalog GET không gửi cookie/token; session đăng nhập vẫn do website quản lý.

Chi tiết: [rủi ro và kiểm thử](docs/RUI_RO_VA_KIEM_THU.md), [cơ chế hoạt động](docs/CO_CHE_HOAT_DONG.md), [kết quả kiểm tra](docs/VALIDATION.md), [review và nguồn](docs/REVIEW_VA_NGUON_THAM_KHAO.md).

## Giới hạn thực tế

- Chỉ thao tác qua DOM website; một số website không nhận synthetic click/input hoặc không khai báo trạng thái chọn, cần adapter tương ứng.
- Chưa có bộ đọc đầy đủ đồng hồ giữ chỗ. Có dừng với một số thông báo hết hạn/lỗi rõ ràng, không bảo đảm phát hiện mọi trường hợp.
- Chưa tự refresh/poll tồn kho, giải CAPTCHA, thay tài khoản hay vượt phòng chờ.
- Không bấm nút thanh toán cuối; không đọc/lưu mật khẩu hoặc thông tin thẻ.
- Giữ Chrome mở, máy thức và đồng hồ đúng. Trang thanh toán chuyển host ngoài quyền sẽ cần thao tác trực tiếp.
- Điều khoản 1Zone và quyền tích hợp/thương mại vẫn cần được đối chiếu riêng; xem các nguồn trong tài liệu khảo sát.
