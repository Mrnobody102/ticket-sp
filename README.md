# Camp vé · Ticket Assistant

Extension Chrome camp vé 1Zone theo hạng, giá và số lượng; dừng ở checkout. Ticketbox có tra cứu và nhận diện luồng, chưa tự mua.

**Bản mới nhất: 0.8.5** · [Tải ZIP cài sẵn](dist/Camp-ve-latest.zip) · [Hướng dẫn cài](CAI-DAT.md).

File nằm trong **`dist/Camp-ve-latest.zip`**. Trên GitHub, mở file → **Download raw file**. Giải nén, vào `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục **`tien-ich`** có `manifest.json`. Không cần Node.js/npm.

Đăng nhập 1Zone → tìm sự kiện → chọn suất, hạng và số vé → **Lưu và camp**. Giữ nguyên tab queue; xác minh xong tool tiếp tục. Thanh toán trên website.

Nhật ký tự lưu 3 lượt gần nhất. Khi gặp lỗi: mở tool → **Trang vé và hiển thị → Lưu nhật ký camp**. [Khảo sát đa sự kiện và giới hạn](docs/KHAO_SAT_DA_SU_KIEN.md). Chưa xác minh checkout đăng nhập thật.

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

Kiểm tra Ticketbox thật: `npm run check:ticketbox`. Thêm `-- --interactive <link>` để tự đăng nhập và xem map trong cửa sổ test 3 phút; chặn giữ vé/thanh toán, báo cáo tại `artifacts/ticketbox-check.json`.

Chi tiết: [cơ chế hoạt động](docs/CO_CHE_HOAT_DONG.md) · [kiểm thử](docs/VALIDATION.md) · [phát hành](docs/PHAT_HANH.md).
