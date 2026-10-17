# Quyết định triển khai · 0.2.0

Mục tiêu là camp **1 vé mặc định**, tự chọn zone/ghế phù hợp và đi tới checkout nhanh, trên phiên trình duyệt của người dùng. Hà Nội là suất mục tiêu; chưa có URL/DOM bước mua được xác nhận. TP.HCM và Lavender chỉ dùng tham khảo. Không dùng ước tính 100–200 vé làm tồn kho.

## Các quyết định

1. Giữ một project WXT. Chia core / application / platforms / infrastructure / UI, không cần backend hay monorepo.
2. Core biểu diễn máy trạng thái và quyết định thuần; không phụ thuộc DOM, React, Chrome.
3. Runner thực thi qua contract và transport; ghi progress trước thao tác, kiểm tra lại sau await, chờ phản hồi thay vì bấm lặp.
4. Background là nơi sở hữu một session camp, khóa tab và revision. Cấu hình bền ở local; phiên camp ở session.
5. Adapter chịu trách nhiệm đọc DOM và thực thi ENTER/CHOOSE/QUANTITY/ADVANCE. Chỉ 1Zone đã có implementation; nền tảng khác chưa được bật.
6. URL policy, tên nền tảng và phạm vi host khai báo trong catalog. Validation, manifest/content matches dùng chung khai báo này.
7. Khi camp, gom DOM changes khoảng 16 ms; chế độ theo dõi khoảng 600 ms. Không polling mạng/refresh tab.
8. Nhắc giờ là tính năng phụ. Đến checkout thì kết thúc automation; người dùng kiểm tra đơn và thanh toán cuối.
9. Tách fixtures tĩnh nhận diện và demo booking có tương tác. Demo dùng transport bộ nhớ và cùng runner/core/adapter, không sửa cấu hình/phiên thật.
10. Các lỗi chưa có contract rõ ràng trả PAUSED/UNKNOWN; log trạng thái trên UI, không âm thầm coi click là thành công.

## Phạm vi bàn giao

| Hạng mục | Có | Cần xác minh tiếp |
|---|---|---|
| Zone/ghế tự cấp | Tự chọn, đọc selected, đặt số lượng, đi tiếp trên fixture | DOM sự kiện thật và cách website xác nhận giữ vé |
| Ghế cụ thể | Một ghế có nhãn/giá đọc được cho 1 vé | Map thật; chưa nhóm ghế liền nhau |
| Phòng chờ | Chờ trạng thái, tiếp tục trên tab chủ khi được vào | Queue/host/session của sale mục tiêu |
| Phiên và dừng | Khóa tab, CAS, hủy khi đổi cấu hình/dừng/đóng tab | Diễn tập trên Chrome cá nhân |
| Nền tảng khác | Domain model + registry + contract dùng chung | Viết adapter, khai báo URL/host, fixtures và E2E riêng |
| Tốc độ | Đo trong E2E fixture và hiển thị số đo phiên | Không suy rộng thành SLA trên mạng/server thật |

Xem [cơ chế kỹ thuật](CO_CHE_HOAT_DONG.md), [kết quả thực thi](VALIDATION.md) và [nguồn đối chiếu](REVIEW_VA_NGUON_THAM_KHAO.md).
