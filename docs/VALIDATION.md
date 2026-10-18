# Kiểm thử · 0.6.0 · 18/10/2026

Kiểm tra trên build production ở `artifacts/release-0.6.0/chrome-mv3`. Giữ nguyên 16 file của `.output/chrome-mv3` 0.5.8 đang được Chrome nạp; đã đối chiếu hash trước/sau. Không thay phiên thật của người dùng.

| Kiểm tra | Kết quả bản cuối |
|---|---|
| TypeScript / unit | PASS; 246 bài, 21 file |
| Chromium E2E | PASS 60/60, không retry, 3,3 phút; 17 catalog, 25 extension, 11 sơ đồ Konva, 7 runtime |
| Mở bán | Nút mua đã xác minh mở sớm; trang cũ cần nhiều lần tải mới; mở trễ; camp ngay với ngày cũ trong tương lai |
| Hàng chờ / tab | Theo dõi queue.1zone.vn; trả về booking hoặc event; chuyển phiên chưa chọn vé sang tab mở tay; chỉ một tab có quyền thao tác |
| Khu vừa hết vé | Thử khu khác trước giữ chỗ, tối đa 5 lần: lúc lưu bước, giữa kiểm tra và click, hoặc sau click nhưng chưa có modal/giữ vé. Adapter phải chứng minh retry an toàn |
| Giá / số lượng / checkout | Giá hoặc modal sai thì chặn; khu đúng class/ID, 1–2 vé; bước mua kèm đúng tổng tiền tự tiếp tục; không bấm thanh toán cuối |
| Vòng đời | Đóng popup, worker bị Chrome ngắt, ẩn panel, dừng, hết phiên, content/worker khác phiên bản và cập nhật giữ ngày đợt bán mới |
| Catalog công khai | GET thật: 1Zone Hà Nội có 4 hạng, HAI QUÝ có 2 khu; Ticketbox dùng API từng suất. Không bật camp, không tạo đơn thật |
| Ticketbox | 4 case: có sơ đồ, nhiều suất không sơ đồ, hết vé/ID 0. Route select-ticket ẩn danh cho ra đăng nhập; chưa kiểm chứng đặt vé sau đăng nhập. Xem [TICKETBOX.md](TICKETBOX.md) |
| Đóng gói | MV3, 16 file local, cú pháp JS hợp lệ, không inline script/private files. Cả hai ZIP khớp SHA-256 từng file production |
| Cài ZIP thật | PASS từ `artifacts/share-install-0.6.0-0438435c/tien-ich`: diễn tập 2 vé tới checkout, 0 pageerror, 0 HTTP request; 2 ảnh 1280×800 |

ZIP bạn bè: `artifacts/release-0.6.0/Camp-ve-0.6.0.zip`, 227.893 byte; SHA-256 `0438435c9a230f365d33b2609e8015027ce61979e27bcffdda95cbaf89b5e513`. Người nhận giải nén, mở `BAT-DAU.html`, nạp `tien-ich`; không chạy npm. Giờ/link lượt bán tiếp theo chưa được cung cấp, không tự suy từ giờ diễn hoặc ngày cũ.

Benchmark production 0.6.0: làm nóng mỗi tình huống một lượt rồi đo 12 lượt, tổng 36 mẫu; 0 pageerror, không click lặp. API/website là fixture cục bộ, không gồm mạng thật, hàng chờ, CAPTCHA hoặc server giữ chỗ.

| Tình huống | Mở giao diện → click mua p50 / p95 | Mở giao diện → checkout p50 / p95 |
|---|---:|---:|
| DOM, phản hồi tức thì | 12,3 / 23,8 ms | 47,0 / 80,9 ms |
| DOM, phản hồi mỗi bước 100 ms | 11,6 / 23,9 ms | 268,3 / 295,4 ms |
| Sơ đồ Konva, modal 2 vé, phản hồi tức thì | Không qua CTA | 83,2 / 185,8 ms |

Mẫu gốc: `artifacts/camp-benchmark.json`, `artifacts/map-benchmark.json`. Không dùng các số này để suy ra thời gian đặt vé thật.

Kiểm thử thao tác dùng dữ liệu tổng hợp và Konva thật trong profile tạm. Chưa xác minh checkout đăng nhập trên website thật; kết quả này không chứng minh server đã giữ vé hoặc thứ tự vào hàng chờ.

---

# Lưu trữ kiểm thử 0.5.6 · 18/10/2026

Windows, Node.js 22.11.0, npm 10.9.0; WXT 0.21.4, Vite 6.4.4, Vitest 4.1.12; Chromium 156 qua Playwright. Kiểm thử đặt vé dùng profile tạm và dữ liệu tổng hợp; không tạo đơn thật.

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| TypeScript và unit | PASS strict/noUnused; 222 bài trong 19 file. `npm run check` đã qua; bản cuối chạy lại typecheck và unit |
| E2E toàn bộ | PASS 50/50 trong 3,7 phút trên output cuối: 16 catalog, 20 extension/diễn tập, 7 Konva, 7 runtime; không retry |
| Sơ đồ Konva 10.3.0 thật | Manifest production chạy cả MAIN/isolated world. Chọn khu bằng zoneId + ticketClassId, bỏ khu khóa, đúng số vé; mỗi bước chỉ một lần, không bấm thanh toán cuối |
| Thay đổi trên sơ đồ | Redraw canvas đánh thức phiên camp dù HTML không đổi; không polling API |
| Giá và danh tính | Giá trên thẻ thay đổi thì dừng trước chọn. Modal sai class/khu, nhiều lựa chọn selected hoặc hạng khác ưu tiên thì không bấm Tiếp tục |
| Cloudflare trong modal | Chờ hơn 5 giây; không gửi tiếp khi nút khóa. Khi nút mở, tiếp tục đúng hạng/số vé dù iframe vẫn còn hiện; không giải CAPTCHA |
| Đã chọn bằng tay | Chỉ tiếp tục modal một khu hợp lệ, khớp ưu tiên/ID/giá; FANZONE không được thay cho GA |
| Show đang bán | Một suất có status OPEN và canPurchase=true chọn chế độ ngay khi bật camp; không bắt nhập ngày, không reload theo giờ cũ |
| Bản nháp | Đóng/mở lại giữ tìm kiếm, sự kiện, hạng, thứ tự, số vé và các ô đang sửa. Chưa Lưu thì không đổi cấu hình/phiên đang chạy |
| Tab đã mở sẵn | Khớp đúng event/calendarId/tab; không tạo tab trùng; từ trang còn khóa hoặc đã có giao diện chọn vé đều tới checkout trong fixture |
| Runtime và vòng đời | Worker cũ, khởi tạo lỗi, START/STOP đến muộn, worker ngắt, đóng popup, browser restart, đóng tab, ẩn panel đều có E2E. Không tự bật lại phiên sau browser restart |
| Đúng ngày bán | Migration 19/10 → 18/10 12:00 giữ lựa chọn/số vé; không tự tạo phiên camp |
| Đóng gói | `npm run release` PASS: manifest MV3, tài nguyên local, cú pháp JS, không inline script/private files; 16 file production trong mỗi ZIP khớp SHA-256 output |
| ZIP sau giải nén | PASS từ `artifacts/share-install-0.5.6-8b040546/tien-ich`: 2 vé tới checkout giả lập, 0 pageerror, 0 HTTP request; 2 ảnh 1280×800 |
| Báo cáo camp | JSON đúng phiên bản/cấu hình/mốc thời gian quan sát; không xuất cookie, form, HTML, preferencesKey, tab ID hoặc query token; không có số lượng quan sát thì để trống |
| Website Hà Nội | 11:36 ngày 18/10: đúng link `8h0YGm`, trạng thái Chưa mở bán; catalog tải được HAI QUÝ - EB giá 2.996.000, 2 khu; lưu đúng 12:00 hôm nay. Chỉ đọc, không bật camp |

ZIP bạn bè: `.output/Camp-ve-0.5.6.zip`, 222.969 byte, SHA-256 `8b04054646d40b4657b7ac772e930129dd05f6f546a8e017bdbc36c3730f5b34`.

ZIP Store: `.output/ticket-sp-0.5.6-chrome.zip`, 218.311 byte, SHA-256 `9a8b5bc22ed8183e77c75a3355e2796c412952d42db36b0f210f7d08e5c8e35e`. Báo cáo từng file: `.output/release.json`.

Một lượt trước có timeout ở bài đóng/mở browser để kiểm tra alarm; chạy riêng và lượt toàn bộ kế tiếp đã đạt. Không thay logic production để bỏ qua kiểm tra này.

## Phạm vi sơ đồ

Renderer công khai của 1Zone dùng Konva và các thuộc tính `zoneId`, `ticketClassId`, `text`, `disabled` trên Node. Bundle đã khảo sát chứa cấu hình Trúc Nhân `fikmaG` và Vương Bình Hà Nội `aAq6NT`. Bridge chỉ đọc các thuộc tính này và phát click lên một Node đã đối chiếu, không dùng tọa độ ảnh hoặc trạng thái React riêng.

Thẻ giá có thể ghi tên hạng chung, còn sơ đồ ghi từng khu. Adapter ghép theo ID từ API rồi đọc giá hiện tại theo tên hạng/khu đã xác minh. Nếu giá mâu thuẫn hoặc không có bằng chứng giá rõ ràng thì không chọn. Sau click phải đọc lại modal đúng khu và số vé trước Tiếp tục.

Nguồn API: [Konva Node](https://konvajs.org/api/Konva.Node.html), [Chrome ExecutionWorld](https://developer.chrome.com/docs/extensions/reference/api/scripting#type-ExecutionWorld). Konva chỉ là devDependency phục vụ fixture; extension không tải thêm thư viện từ mạng.

Ảnh/SVG có nhãn, giá và điều khiển rõ ràng được đọc bằng DOM/ARIA. Ảnh pixel đơn thuần, renderer iframe khác hoặc nhóm nhiều ghế chưa có adapter không được coi là đã hỗ trợ. Ghế riêng phải có danh tính riêng; không gộp cả nhóm thành một zone.

## Tốc độ

`npm run bench:camp` chạy extension production 0.5.6: mỗi tình huống làm nóng một lượt rồi đo 12 lượt, tổng 24 mẫu, không lỗi trang hoặc click lặp. Website/API là fixture DOM với khu HAI QUÝ 1 và modal cùng khu, không phải benchmark tốc độ Konva hoặc website thật.

| Độ trễ website mô phỏng mỗi bước | CTA mở → click mua, p50 / p95 | CTA mở → checkout, p50 / p95 |
|---|---:|---:|
| 0 ms | 8,4 / 34,4 ms | 35,5 / 89,0 ms |
| 100 ms | 7,5 / 12,5 ms | 255,4 / 285,2 ms |

Kết quả ở `artifacts/camp-benchmark.json`. Số đo được lấy trước thay đổi cuối chỉ bổ sung tên hạng chung khi tìm thẻ giá sơ đồ. Thay đổi này được kiểm tra bằng E2E riêng, chưa đo lại p95 cho Konva.

Catalog và handshake chạy khi bắt đầu camp, trước giờ bán; không thêm GET catalog hoặc sleep giữa các bước chọn vé. Theo dõi DOM và redraw dùng lại bộ lập lịch hiện có. Phải chờ website xác nhận số lượng và chuyển trang; không gửi lại yêu cầu giữ vé khi chưa rõ kết quả.

## Website thật và giới hạn

Đã đọc HTML, summary/zones API và renderer công khai. Suất Hà Nội có 4 hạng/12 khu, seatType auto, ticketType seatmap_zone; saleConfig rỗng. Trúc Nhân có summary type=zone/ticketType=auto_send_ticket; adapter mới cũng tải zones cho kiểu này.

Khảo sát ẩn danh trước đó trên Lavender, Trúc Nhân và Lời Chưa Kịp Nói xác nhận CTA đi đến đăng nhập; chặn request ghi, không giữ vé. Chưa có phiên Chrome của người dùng được kết nối để kiểm tra checkout bằng tài khoản đã đăng nhập. Kiểm thử fixture và việc đọc public API không thay thế một giao dịch thật.

Phòng chờ được giữ nguyên; modal xác minh đã biết chờ rồi tiếp tục khi nút mở. Xác minh ngoài modal, đăng nhập hoặc phiên hết hạn cần xử lý trên website. Tool dừng tự động hóa ở checkout để người dùng kiểm tra đơn và thanh toán.

Reload extension rồi tải lại tab mới thay content script cũ. Workflow CI đã chuẩn bị nhưng chưa xác nhận kết quả CI của commit này; chưa phát hành Chrome Web Store. Ticketbox hiện chỉ tra cứu. Backend cấp quyền thương mại chưa triển khai.
