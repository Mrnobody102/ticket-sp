# Camp vé · Ticket Assistant

Extension Chrome hỗ trợ camp vé 1Zone theo hạng, giá và số lượng; dừng ở checkout để bạn kiểm tra và thanh toán. Ticketbox hiện chỉ tra cứu.

**Bản mới nhất: 0.7.1** · [Tải ZIP cài sẵn](dist/Camp-ve-latest.zip) · [Hướng dẫn cài](CAI-DAT.md).

File nằm trong **`dist/Camp-ve-latest.zip`**. Trên GitHub, mở file → **Download raw file**. Giải nén, vào `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục **`tien-ich`** có `manifest.json`. Không cần Node.js/npm.

Đăng nhập 1Zone → chọn **CAPITANEUS MUTABILIS** → chọn hạng, số vé và giờ bán → **Lưu và camp**. Tool tự chọn ghế, kiểm tra giỏ và đi tới checkout. Nếu website yêu cầu xác minh, hoàn thành trên tab vé; tool tiếp tục trong cùng phiên.

Event: [CAPITANEUS MUTABILIS · XDacU6](https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6), tối đa 2 vé/hạng. Tự chọn ghế cùng khu, ưu tiên liền nhau. Bản 0.7.1 sửa chờ xác minh sau queue và SDK treo; báo rõ khi thiếu ghế. Chưa xác minh checkout đăng nhập thật. [Queue và lỗi ghế](docs/QUEUE_VA_GHE.md).

## Phát triển

Node.js 22 trở lên:

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npm run release
```

`release` build và kiểm tra gói, cập nhật duy nhất ZIP mới nhất cùng checksum trong `dist`. Commit `dist` cùng source để bạn bè tải từ GitHub. Khi tự phát triển, Load unpacked từ `.output/chrome-mv3`; không dùng bản dev để test bán thật.

Chi tiết: [cơ chế hoạt động](docs/CO_CHE_HOAT_DONG.md) · [kiểm thử](docs/VALIDATION.md) · [phát hành](docs/PHAT_HANH.md).
