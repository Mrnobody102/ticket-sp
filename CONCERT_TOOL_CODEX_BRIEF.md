# Concert Ticket Assistant — Codex Implementation Brief

> **Phạm vi 0.4.2 theo điều chỉnh người dùng:** tìm sự kiện và chọn suất/hạng/giá từ API; chuẩn bị ưu tiên/số lượng/giờ từ trước; tự vào mua vé, chọn zone/ghế theo ưu tiên, đặt số lượng và chuyển tới checkout. Nhắc giờ là phần phụ. Core/runner, CatalogProvider và booking adapter tách riêng để mở rộng nền tảng. 1Zone có catalog + adapter; Ticketbox mới tra cứu; CTicket chưa kết nối. Bản 0.4.0 thêm preset Hà Nội, modal theo dấu hiệu public, lịch microtask, reload một lần khi trang còn khóa tại giờ bán và benchmark. 0.4.1 sửa cập nhật worker/UI, mở workspace, nhãn sự kiện và dùng select catalog làm luồng mặc định. 0.4.2 xử lý lỗi khởi tạo panel, gọn UI, thêm hướng dẫn trong tool và gói ZIP gửi bạn bè. Phần brief phía dưới giữ làm ngữ cảnh ban đầu; hành vi hiện hành theo [cơ chế](docs/CO_CHE_HOAT_DONG.md), [nghiên cứu API](docs/NGHIEN_CUU_API.md) và [quyết định triển khai](docs/IMPLEMENTATION.md).

> **Điều chỉnh 17/10/2026:** một project WXT ở root, tách `src/core`, `src/platforms`, `src/infrastructure`, `src/ui`; chưa cần monorepo/backend. Xem [kế hoạch cập nhật](docs/IMPLEMENTATION.md) và [hướng dẫn chạy](README.md).
>
> **Đã xác nhận:** thử fan meeting Vương Bình tại Hà Nội, dự kiến toàn sự kiện 100–200 vé (ước tính của người dùng, không phải tồn kho), ngân sách không giới hạn. Mặc định **1 vé**, cho chọn theo giới hạn của suất/hạng. Ngày 18/10 đã đọc được [suất Hà Nội Mâm 2](https://ticket.1zone.vn/events/vuong-binh-tiec-thanh-than-mam-2?calendarId=8h0YGm) cùng hạng/giá; người dùng xác nhận **12:00 ngày 19/10/2026 UTC+7** làm mặc định có thể sửa. API chưa xác nhận độc lập giờ bán; DOM booking đăng nhập chưa xác minh. Link TP.HCM và map event khác chỉ tham khảo.
>
> **Bổ sung P0:** Chrome Alarms khôi phục sau worker restart và ghi dấu chống nhắc lặp; chỉ highlight khi khớp event/`calendarId`; demo nội bộ không thêm quyền localhost; tôn trọng giới hạn số vé đọc được. Fixtures là mô phỏng ngữ nghĩa, chưa phải DOM fan meeting sắp mở bán.

> **Ngày tạo:** 17/10/2026 (Asia/Ho_Chi_Minh)\
> **Hạn MVP:** 18/10/2026 — cần bản chạy được trên máy cá nhân trước đợt mở bán mục tiêu.\
> **Ưu tiên:** 1Zone trước; kiến trúc mở rộng Ticketbox, CTicket về sau.\
> **Mục đích tài liệu:** Ngữ cảnh + yêu cầu triển khai để Codex đọc repo, rà soát khả thi, lập kế hoạch NGẮN và lập tức bắt đầu thực hiện các task P0. Không chỉ trả về kế hoạch.

## 1. Bài toán và định hướng sản phẩm

Xây một công cụ hỗ trợ người dùng **canh/săn vé concert** trên các website bán vé Việt Nam. Điểm xuất phát là **1Zone** để sử dụng ngay ngày 18/10/2026, nhưng không viết một script dùng một lần hoặc kiến trúc gắn cứng với 1Zone.

Mô hình sản phẩm dự kiến về sau:

1. **Self-service:** người mua một Event Pass, cài công cụ trên máy, cấu hình hạng vé/số lượng/ngân sách và tự thực hiện giao dịch.
2. **Managed service:** khách gửi yêu cầu; nhân viên hỗ trợ và vận hành tác vụ theo phạm vi được nền tảng cho phép; thu phí dịch vụ.
3. **Một codebase và một core workflow**, nhiều platform adapters. Không xây 3 bot độc lập.

Đích cuối cùng: 1Zone, Ticketbox, CTicket. **Ngày mai chỉ cam kết 1Zone MVP**; hai nền tảng còn lại chỉ cần interface và roadmap, không giả hỗ trợ.

### Phân biệt mức độ automation

- **INFO:** lịch mở bán, trạng thái hiển thị công khai, nhắc giờ.
- **ASSIST (MVP):** tiện ích trình duyệt hỗ trợ trên trang đang mở bằng session thật của người dùng: nhận biết event/trạng thái, làm nổi bật lựa chọn phù hợp, hỗ trợ điều hướng và xác nhận thủ công.
- **AUTHORIZED_BOOKING (sau MVP):** tự động hóa chọn/giữ vé hoặc đặt vé E2E **chỉ khi có quyền tích hợp/ủy quyền hợp lệ** của nền tảng và đáp ứng chính sách sự kiện.

**Không tuyên bố công cụ sẽ mua được vé tự động vào ngày mai** nếu chưa xác minh quyền tích hợp, luồng thực tế và thử nghiệm hợp lệ. Không có bảo đảm mua vé thành công.

## 2. Điều kiện thực tế phải kiểm tra ngay

- **Target event của ngày 18/10 chưa được cung cấp:** tạo trường cấu hình `eventUrl` và `saleStartAt`; không đoán concert nào, không block phần còn lại để hỏi. Chỉ cần người sử dụng nhập link sự kiện thực tế trước khi chạy.
- **1Zone có nhiều dạng chọn vé**: chọn khu vực không chọn chỗ, chọn ghế cụ thể, và tự cấp ghế; giới hạn số vé khác nhau theo sự kiện. Không mặc định có `seat_id`, zone layout hay cùng selector.
- 1Zone có các host công khai như `ticket.1zone.vn`; host khác chỉ thêm sau khi xác minh, không dùng quyền `*://*/*`.
- Trang web có thể dùng SPA navigation, popup, thay đổi DOM và các bước queue/challenge không xác định trước. Không đoán API nội bộ hay giả định Cloudflare đang được sử dụng.
- Cần kiểm tra điều khoản hiện hành của 1Zone và từng event trước khi bật hỗ trợ tương tác hoặc kinh doanh. Việc tham gia queue, CAPTCHA, đăng nhập và thanh toán vẫn do người dùng thực hiện.

Nguồn kiểm chứng ban đầu:

- Trang sự kiện công khai: <https://ticket.1zone.vn/>
- Ví dụ chọn khu vực, tối đa 2 vé/giao dịch: <https://ticket.1zone.vn/events/ngay-em-den>
- Ví dụ chọn ghế, tối đa 10 vé/giao dịch: <https://ticket.1zone.vn/events/yeu-nguoi-co-uoc-mo-12882?calendarId=2InwCp>
- Ví dụ tự cấp ghế: <https://ticket.1zone.vn/events/tram-yeu-5>
- Điều kiện cung cấp hàng hóa/dịch vụ: <https://doc.1zone.vn/vi/policy/supply-conditions/>
- Chính sách cung cấp dịch vụ: <https://doc.1zone.vn/vi/policy/service-delivery/>

**Cảnh báo:** các trang ví dụ có thể đã hết vé; dùng để hiểu sự đa dạng quy trình, **không** dùng chúng làm bằng chứng rằng ngày 18/10 có sale. Nếu event mục tiêu chưa có, kiểm thử local fixture hoặc giao diện công khai ở chế độ đọc, không phát sinh giữ vé/đơn hàng thật.

## 3. Quyết định triển khai cho MVP

**Ưu tiên: Chrome Extension (Manifest V3) chạy cục bộ, TypeScript + React (UI) + WXT.**

- Extension chạy trên trình duyệt người dùng, không chạy browser farm trên server.
- Popup là nơi chọn / sửa event URL, giờ mở bán, hạng vé ưu tiên, số lượng, giá tối đa, phương án thay thế.
- Content script nhận biết trang 1Zone đang mở và hiển thị một panel **gọn, dễ hiểu**, trạng thái + checklist + lựa chọn phù hợp.
- Background chỉ làm điều phối các event/tab/notification; **không lưu state cốt lõi trong biến global** do service worker MV3 có thể ngủ/dừng.
- `chrome.storage.local` giữ cấu hình không nhạy cảm và trạng thái tác vụ, khôi phục sau refresh.
- **Chưa làm Backend, đăng nhập sản phẩm, thu phí hay license trong P0.** Tạo seam interface đủ để thêm sau, không dựng microservices hay infra vô ích.
- Phát hành nội bộ ngày mai bằng **Load unpacked extension**, không phụ thuộc Chrome Web Store duyệt kịp.

Công nghệ tham khảo:

- WXT: <https://wxt.dev/>
- WXT Entry Points: <https://wxt.dev/guide/essentials/entrypoints>
- Chrome MV3 Service Worker: <https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>
- Chrome Permissions: <https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions>

**Repo chưa biết trạng thái:** Codex phải xem cấu trúc thật trước. Nếu repo trống, khởi tạo WXT đơn giản. Nếu đã có code, tái sử dụng convention/phụ thuộc phù hợp, tránh rewrite. Không bắt buộc monorepo ngày mai.

## 4. Trải nghiệm sử dụng phải có vào ngày mai

1. Người dùng cài extension (unpacked), click icon.
2. Nhập **link concert trên 1Zone**, giờ mở bán theo timezone `Asia/Ho_Chi_Minh`, số lượng vé muốn mua, ngân sách và danh sách hạng vé theo thứ tự ưu tiên.
3. Bấm **Lưu cấu hình** và **Mở trang sự kiện** (trang chính thức 1Zone).
4. Trên website, panel extension hiển thị:
   - Đúng/sai sự kiện đã cấu hình;
   - trạng thái: `NOT_READY`, `WAITING_ROOM`, `EVENT_PAGE`, `SELECTING`, `CHECKOUT`, `CHALLENGE`, `UNKNOWN`;
   - giờ mở bán và countdown trên máy khách (không khẳng định đồng bộ tuyệt đối với server);
   - hạng vé ưu tiên, số lượng và ngân sách;
   - nút **Nhận diện lại**, **Bật/tắt panel**, **Mở trang sự kiện**, **Dừng**.
5. Khi có thông tin hiển thị hợp lệ trong giao diện, công cụ **đọc và làm nổi bật** zone/ticket type phù hợp với preferences; nếu không xác định chắc chắn, báo `UNKNOWN` thay vì tự chọn sai.
6. Khi đến bước người dùng có thể chọn vé, hiển thị lựa chọn rõ ràng và hướng dẫn thao tác. Không gửi yêu cầu đặt vé trực tiếp hay xác nhận giao dịch ngoài luồng chính thức.
7. Khi thấy challenge/CAPTCHA, queue hoặc thanh toán, hiển thị trạng thái phù hợp và **để người dùng thao tác**, không tìm cách vượt qua.
8. Sau reload, quay lại trang hoặc service worker restart: khôi phục cấu hình, không tạo tác vụ trùng.
9. Có bộ fixture mô phỏng các trạng thái để demo và test ngay cả khi không có sale thật.

### Quy tắc nhận diện giao diện

- Ưu tiên thông tin **hiển thị cho người dùng** như role/accessible label/text, tiêu đề, giá, trạng thái nút; class/ID chỉ dùng làm bổ trợ khi đã quan sát thực tế.
- Với DOM động, `MutationObserver` + xử lý debounce/throttle; không polling liên tục ở tần suất cao.
- Bảo vệ trước SPA route changes, iframe/canvas không đọc được hoặc giao diện thay đổi. Trả `UNSUPPORTED_VARIANT`/`UNKNOWN` và cho phép thao tác thủ công.
- Không giả định luôn có nút zone hoặc seat; phân loại `ZONE_ONLY | ASSIGNED_SEAT | PICK_SEAT | UNKNOWN`.
- **Không tự click mù, không click giữ chỗ/đặt vé/thanh toán khi chưa có quyền và xác nhận rõ ràng.**

## 5. Kiến trúc tối thiểu nhưng mở rộng được

```text
concert-tool/
├── apps/
│   └── extension/                 # WXT + TypeScript + React
│       ├── entrypoints/
│       │   ├── popup/             # preferences + start/stop
│       │   ├── background.ts      # message/notification/tab event handling
│       │   └── 1zone.content.ts   # 1Zone content script
│       └── ...
├── packages/                      # nếu repo monorepo; nếu cần nhanh có thể đặt dưới src/
│   ├── core/
│   │   ├── models.ts              # EventTarget, Preferences, WorkflowState
│   │   ├── workflow.ts            # state transitions
│   │   ├── storage.ts             # config repository interface
│   │   └── contracts.ts           # PlatformAdapter
│   ├── platforms/
│   │   ├── onezone/               # detector/reader/variant recognizer
│   │   ├── ticketbox/             # placeholder ONLY
│   │   └── cticket/               # placeholder ONLY
│   └── ui/                        # optional shared widgets
├── fixtures/                       # local HTML/demo states
├── tests/
└── README.md                       # install + use + limitations
```

Đừng tốn thời gian cấu hình workspace nặng nếu gây chậm. **Tách các interface/adapter là đủ**, có thể chuyển thành monorepo sau.

### Contract đề xuất

```ts
type Platform = 'onezone' | 'ticketbox' | 'cticket';
type SeatSelectionMode = 'ZONE_ONLY' | 'PICK_SEAT' | 'ASSIGNED_SEAT' | 'UNKNOWN';
type WorkflowState =
  | 'NOT_READY' | 'WAITING_ROOM' | 'EVENT_PAGE' | 'SELECTING'
  | 'CHECKOUT' | 'CHALLENGE' | 'UNKNOWN' | 'STOPPED';

type EventPreferences = {
  eventUrl: string;
  saleStartAt: string;       // ISO 8601 with offset or explicit timezone
  platform: Platform;
  quantity: number;
  maxTotalVnd?: number;
  preferredZoneLabels: string[]; // ordered preference, not internal zone IDs
  allowAlternatives: boolean;
};

type VisibleOption = {
  label: string;
  displayedPriceVnd?: number;
  displayedAvailability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
};

type PageSnapshot = {
  url: string;
  state: WorkflowState;
  selectionMode: SeatSelectionMode;
  visibleOptions: VisibleOption[];
  supported: boolean;
  reason?: string;
};

interface PlatformAdapter {
  readonly platform: Platform;
  matches(url: URL): boolean;
  inspectVisiblePage(document: Document, url: URL): PageSnapshot;
}
```

- Không import dependency trình duyệt vào core logic thuần để có thể unit-test.
- `inspectVisiblePage` phải **read-only**. UI highlighting tách khỏi adapter; extension không được coi dữ liệu DOM là tin cậy tuyệt đối.
- `TicketboxAdapter` và `CTicketAdapter` lúc này trả về `unsupported` rõ ràng; **không tạo code giả làm như đã tương thích**.
- Không đưa credentials, cookies, CAPTCHA tokens hoặc thông tin thẻ vào logs/telemetry.

## 6. Thứ tự triển khai — làm P0 trước, demo được từng bước

| Ưu tiên | Task | Hoàn thành khi |
|---|---|---|
| P0 | Kiểm tra repo, công nghệ, docs; xác định target URL đầu vào | Báo cáo ngắn và lập kế hoạch <= 1 trang |
| P0 | Khởi tạo/bảo toàn dự án extension WXT MV3 | `dev` và `build` thành công, load vào Chrome |
| P0 | Popup cấu hình event URL, sale time, quantity, zone labels | Lưu được vào `chrome.storage.local`, reload còn |
| P0 | 1Zone URL matching + panel trong trang | Chỉ kích hoạt ở host phù hợp; panel không che thao tác mua |
| P0 | Page state detector + visible option reader | Phân biệt trạng thái trong fixtures; khi không chắc trả `UNKNOWN` |
| P0 | Event countdown + cảnh báo khi đến giờ | Nhắc giờ theo cấu hình; không tự spam/refresh |
| P0 | Fixtures + smoke tests + README | Test được 3 loại sơ đồ vé và trạng thái lỗi |
| P0 | Diễn tập end-to-end không tạo giao dịch | Popup -> mở event -> panel -> phát hiện -> highlight -> stop |
| P1 | Cải thiện adapter dựa trên giao diện event mục tiêu đã được phép kiểm tra | Không hardcode nhầm quy trình với event khác |
| P1 | Unit test workflow, chống observer/notification duplicate | Test green |
| P1 | UX polishing, accessibility, error messages | Người mới tự cài và dùng được |
| P2 | Server quản lý event + license + entitlement | Thiết kế sau sale MVP |
| P2 | Booking requests + operator dashboard | Thiết kế sau, chỉ khi mô hình mua hộ hợp lệ |
| P2 | Ticketbox + CTicket adapters | Triển khai sau khi có fixture/kiểm thử riêng |

**Thứ tự thực thi:** scaffold → popup + storage → adapter read-only → panel → fixtures/tests → smoke test → tài liệu. Nếu hết thời gian, ưu tiên bản cài được + hoạt động nhất quán hơn là thêm tính năng chưa kiểm thử.

## 7. Những thứ cố ý KHÔNG làm vào ngày mai

- Reverse-engineer private booking API, POST giữ vé trực tiếp, bypass DOM/queue.
- Anti-detect browser, fingerprint spoofing, residential proxy rotation, mass-account sessions.
- CAPTCHA solving/bypass; lấy hoặc tái sử dụng queue admission token; vượt giới hạn mua vé.
- Auto checkout, auto-payment, thu thập thông tin thẻ/OTP, chạy hidden browser farm.
- Phân phối extension qua Chrome Web Store đúng hạn (không đảm bảo duyệt kịp).
- Backend + Spring Boot + Postgres + Redis + billing chỉ để demo một công cụ nội bộ ngày mai.
- Giữ nhiều session độc lập hoặc spam các endpoint để tạo lợi thế không công bằng.

**Lý do:** vừa không phù hợp mục tiêu MVP 1 ngày, vừa có rủi ro phá vỡ chính sách và làm hệ thống bán vé bị ảnh hưởng. Sau này có thể mở rộng tự động hóa E2E trên những nền tảng có ủy quyền/tích hợp hợp lệ.

## 8. Test/DoD quan trọng nhất

### Test trên local fixtures

- `ZONE_ONLY`: nhận diện zone và highlight đúng ưu tiên, không select sai.
- `PICK_SEAT`: nhận diện chế độ chọn ghế; không cố quy đổi ghế từ tọa độ canvas khi không có dữ liệu tin cậy.
- `ASSIGNED_SEAT`: báo rõ ghế tự cấp, không hiển thị thao tác chọn seat không tồn tại.
- `WAITING_ROOM` và `CHALLENGE`: dừng chức năng tương tác, không auto refresh hay auto solve.
- Không thể xác định trạng thái: hiển thị `UNKNOWN` và fallback thao tác thủ công.
- Thay DOM hoặc SPA navigation: quan sát lại không duplicate panel/listener.
- Đóng/mở popup, refresh tab, background restart: giữ config, không sinh nhiệm vụ trùng.
- URL không thuộc 1Zone: không chèn panel, không truy xuất trang.

### Smoke test trên trang thật (chỉ theo dõi/đọc)

- Mở URL công khai 1Zone: extension không crash, nhận diện host, hiển thị panel đúng nơi.
- Không thao tác giao dịch thật khi chưa có quyền/hợp đồng thử nghiệm.
- Xác minh event mục tiêu ngày 18/10 bằng URL người dùng cung cấp; ghi lại rõ feature nào supported/unsupported.

### Definition of Done

- [ ] Chrome extension load được bằng `Load unpacked`.
- [ ] Cấu hình concert và thứ tự ưu tiên vé được lưu/khôi phục.
- [ ] 1Zone panel hoạt động trên trang phù hợp, xử lý trạng thái chưa biết an toàn.
- [ ] Có fixture/demo không lệ thuộc concert thật.
- [ ] Build/test chạy và kết quả được báo cáo trung thực.
- [ ] README hướng dẫn cài, mở popup, nhập link, cấu hình, kiểm thử, xử lý sự cố.
- [ ] Có danh sách known limitations, đặc biệt không cam kết tự mua vé.

## 9. Kế hoạch sau MVP (không thực hiện trước P0)

1. **Platform support matrix**: event type, flow, UX, captcha/queue boundaries, điều khoản tích hợp cho 1Zone/Ticketbox/CTicket.
2. **Commercial entitlement**: account, Event Pass, một active session/event, revoke, audit, chống chia sẻ license. Không lấy number-of-requests làm quyền lợi gói trả phí.
3. **Managed workflow**: khách tạo ticket request → operator nhận → theo dõi → khách tự xác thực/thanh toán → báo trạng thái. Không giữ mật khẩu/OTP/thẻ.
4. **Backend (khi thực sự cần)**: Next.js web quản trị/bán pass, Spring Boot hoặc một API backend vừa đủ, PostgreSQL; Redis chỉ khi có nhu cầu queue/job coordination thực tế.
5. **Reliability & observability**: event-specific fixtures; compatibility CI; cảnh báo adapter mất tương thích; thống kê lỗi, không lưu dữ liệu nhạy cảm.
6. **Authorized booking integrations**: chỉ phát triển E2E workflow khi xác nhận được quyền tích hợp và phương thức chuẩn.

## 10. Chỉ dẫn trực tiếp cho Codex (bắt đầu ngay)

**Vai trò:** senior browser-extension engineer/tech lead. Ưu tiên ship tool usable hơn là viết architecture doc dài.

1. `pwd`, kiểm tra repo hiện có, đọc README/package manifests, tuân theo công nghệ và convention nếu đã có.
2. Xác định repo trống hay có code. Tóm tắt nhanh chiến lược thực hiện và rủi ro lớn nhất trong <= 12 dòng.
3. Bắt tay **implement các task P0 theo thứ tự mục 6**, không dừng ở lập kế hoạch.
4. Không bịa selector, URL event, API, khả năng bypass hay kết quả test. Nếu chưa có live event: dùng fixtures, ghi rõ limitation.
5. Làm core+adapter tối giản, không over-engineer. Viết tests phù hợp phần đã xây.
6. Kiểm tra `typecheck`, `build`, `test` (nếu có). Sửa lỗi, không chỉ mô tả.
7. Cuối cùng bàn giao: file đã tạo/sửa, lệnh chạy, đường dẫn thư mục build unpacked, thao tác test trong Chrome, phần chạy được/chưa được, và **3 việc cần làm trước đợt sale thật**.
8. Với thông tin còn thiếu, chọn defaults hợp lý và cấu hình qua popup. **Không chờ phản hồi trừ khi buộc phải có xác thực/quyền truy cập một tài khoản thật.**

### Acceptance demo

Người sử dụng cài extension → nhập URL concert 1Zone mục tiêu + giờ bán → chọn 2-3 zone ưu tiên + số lượng → lưu → mở trang chính thức → panel nhận diện tình trạng và highlight lựa chọn khả dụng nếu UI hiển thị → nhận nhắc giờ → tiếp tục mua thủ công trên website chính thức. Công cụ không crash, không spam, không tự mua ngoài quyền cho phép.

---

## Ghi chú cho quyết định sản phẩm

- **Ngày 18/10/2026 = mốc có bản MVP dùng được**, không đồng nghĩa xác nhận có một sự kiện 1Zone mở bán ngày đó.
- Nếu người dùng sau đó muốn công cụ chọn vé tự động hoàn toàn, phải làm riêng **feasibility & authorization gate** cho event/website tương ứng; không biến nhu cầu đó thành một giả định đã chứng minh.
- Không thổi phồng yêu cầu chống spam thành một hệ thống anti-fraud phức tạp trước khi có người dùng trả phí; MVP dùng một tab/session và một tác vụ là đủ.
