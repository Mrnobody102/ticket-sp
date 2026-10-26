# Camp vé · Ticket Assistant

Extension Chrome hỗ trợ camp vé 1Zone theo hạng, giá và số lượng; dừng ở checkout để bạn kiểm tra và thanh toán. Ticketbox hiện chỉ tra cứu.

**Bản mới nhất: 0.6.4** · [Tải ZIP cài sẵn](dist/Camp-ve-latest.zip) · [Hướng dẫn cài](CAI-DAT.md).

File nằm trong **`dist/Camp-ve-latest.zip`**. Trên GitHub, mở file → **Download raw file**. Giải nén, vào `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục **`tien-ich`** có `manifest.json`. Không cần Node.js/npm.

Đăng nhập 1Zone → dán link sự kiện vào ô tìm → chọn đúng suất và hạng → số vé/giờ bán → **Lưu cấu hình** → **Bắt đầu camp**. CAPTCHA cần tự xác minh trên website.

Event cần test: [CAPITANEUS MUTABILIS · XDacU6](https://ticket.1zone.vn/events/capitaneus-mutabilis-2026?calendarId=XDacU6). API công khai hiện khai báo cấp ghế tự động, tối đa 2 vé/hạng; trang vẫn “Sắp mở bán”. Xem [kết quả kiểm tra và giới hạn](docs/CAPITANEUS.md). Sơ đồ chọn từng ghế trong iframe chưa được tự động hóa; tool dừng nếu không xác minh được lựa chọn.

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
