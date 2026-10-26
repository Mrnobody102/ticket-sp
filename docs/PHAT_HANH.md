# Phát hành và quyền sử dụng

## Bản thử hiện tại

Người nhận tải **`dist/Camp-ve-latest.zip`** trên GitHub bằng **Download raw file**: giải nén, mở `BAT-DAU.html`, nạp thư mục `tien-ich` vào Chrome. Hướng dẫn ngắn ở [CAI-DAT.md](../CAI-DAT.md). Không cần source, Node.js hay npm. Mỗi người tự đăng nhập website bán vé; ZIP không chứa cấu hình hoặc phiên tài khoản của người tạo gói.

Gói `.output/ticket-sp-0.6.4-chrome.zip` là extension ở thư mục gốc, dùng để tải lên Web Store. Hai gói có cùng nội dung extension. `dist/release.json` lưu phiên bản/hash từng file; `dist/SHA256SUMS.txt` lưu hash ZIP tải sẵn. Mỗi lần `npm run release` ghi đè bản mới nhất vào `dist`, không lưu nhiều ZIP theo phiên bản tại đó.

Người phát triển có thể tạo gói bằng `npm run release`, hoặc mở GitHub → Actions → **Build tested extension** → **Run workflow** và tải artifact **Camp-ve** khi kiểm tra thành công. Workflow chưa tự đăng Web Store hay tạo release công khai. Người dùng cuối chỉ nhận ZIP hoặc link cài.

## Cài qua link Web Store

Đây là kênh phân phối chính khi có tài khoản; Chrome Windows/macOS giới hạn việc cài CRX bên ngoài Store. Không tạo một EXE chỉ để yêu cầu bật Developer mode. Xem [các phương thức cài chính thức](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions).

1. Dùng tài khoản Google để [đăng ký nhà phát triển](https://developer.chrome.com/docs/webstore/register), trả phí đăng ký một lần, hoàn thành thông tin tài khoản và bảo mật mà dashboard yêu cầu. Không cần Google Workspace. Chưa đăng ký hoặc trả phí thay người dùng.
2. Upload gói Web Store, dùng nội dung trong [WEB_STORE.md](WEB_STORE.md), bổ sung email hỗ trợ, URL chính sách quyền riêng tư do chủ tool quản lý và ảnh đúng kích thước. `public/quyen-rieng-tu.html` là bản chính sách phù hợp với bản hiện tại, chưa có tài khoản/server riêng.
3. Lần đầu chọn **Private** và thêm Google Account của bạn bè vào trusted testers. Khi được duyệt, mỗi người cài từ link bằng tài khoản của họ. **Unlisted** chỉ ẩn tìm kiếm: bất cứ ai có link đều có thể cài. Cả hai chế độ vẫn phải qua xét duyệt, không bảo đảm kịp buổi bán vé 12:00 ngày 18/10/2026. [Quy định phân phối](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution).
4. Những bản cập nhật sau giữ cùng item ID, tăng version và upload bản đã kiểm thử. Người cài qua Store nhận cập nhật qua Chrome. Bản Load unpacked vẫn cần thay file, Reload extension và tải lại tab bán vé.

## Bản thương mại: phần cần xây tiếp

**0.5.6 vẫn miễn phí, không có khóa chống chia sẻ.** Không nhúng “mã bí mật” trong extension hoặc dùng một cờ localStorage để giả làm cấp quyền. Bản ZIP đã phát hành có thể bị sao chép; không thể thu hồi từ xa một bản offline không có máy chủ kiểm soát. Đặt `license: UNLICENSED` chỉ mô tả trạng thái cấp phép source, không phải biện pháp bảo vệ kỹ thuật.

Khi triển khai thương mại, cần một dịch vụ tài khoản/quyền dùng thật:

| Thành phần | Trách nhiệm |
|---|---|
| Tài khoản | Đăng nhập, khôi phục tài khoản; bạn bè có gói miễn phí do chủ tool cấp |
| Máy chủ quyền dùng | Lưu gói, thời hạn, trạng thái thu hồi, số thiết bị/phiên cho phép; xác thực độc lập mỗi yêu cầu |
| Đăng ký thiết bị | Installation ID ngẫu nhiên, người dùng xem và hủy thiết bị; không fingerprint ngầm |
| Preflight trước camp | Xác thực quyền và cấp permit ngắn hạn gắn tài khoản, installation ID, event/performance và thời hạn |
| Đường chọn vé | Kiểm tra permit đã chuẩn bị cục bộ; không gọi server cấp quyền giữa từng click |
| Dịch vụ được bảo vệ | API phía máy chủ luôn kiểm tra quyền. Token ngắn hạn, giới hạn phiên, thu hồi refresh token và không log cookie/token website bán vé |

Thu hồi ngăn cấp phiên mới; phiên đã được cấp có thể tồn tại tới hết thời hạn permit. Chọn khoảng thời hạn khi có yêu cầu vận hành cụ thể, không đặt tùy tiện rồi khóa người mua ngay giữa lượt giữ vé. Nếu server quyền dùng lỗi, không mở phiên thương mại mới; phải báo trước giờ bán thay vì chờ tới đúng mốc chạy.

Code extension nằm trên máy người dùng nên một người có thể sửa bỏ kiểm tra cục bộ. Muốn hạn chế bản sao sử dụng dịch vụ của mình, quyền truy cập dữ liệu/dịch vụ có giá trị phải được máy chủ thực thi; không có cam kết “không thể share” chỉ bằng đóng gói hoặc làm rối JavaScript. Repo/source cũng cần được chủ sở hữu quản lý quyền truy cập riêng. Chưa xác minh visibility repo vì máy không có GitHub CLI; không tự thay đổi visibility.

Chrome Web Store Payments và licensing API cũ đã bị ngừng; dùng hệ thống thanh toán/cấp quyền riêng. [Thông báo của Chrome](https://developer.chrome.com/docs/webstore/cws-payments-deprecation). Logic extension vẫn đóng trong gói MV3; máy chủ trả dữ liệu/quyền, không tải JavaScript từ xa để chạy. [Chính sách MV3](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements).

Chưa thêm backend giả, màn nhập key hoặc mã khóa không kiểm chứng vào bản thử. Khi có domain/server và cách bán cụ thể, điểm tích hợp là preflight `AUTO_START`, trước khi tạo session; core xếp hạng và adapter website giữ nguyên hợp đồng hiện tại.
