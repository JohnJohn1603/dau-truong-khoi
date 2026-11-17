# Đấu Trường Khối

Bản thử chiến đấu (Giai đoạn 1) cho một game đấu kiếm sinh tồn, góc nhìn thứ nhất, đồ hoạ voxel, chạy trên trình duyệt. Bạn đấu tay đôi 1v1 với bot. Thắng 3 hiệp trước là thắng trận.

- **Bản đang chạy:** https://claude.ai/artifact/5U3VY2e5M5hA5eaqv9Uens
- **Lộ trình phát triển:** https://claude.ai/artifact/5hR5UfkL8GRr3q8JhR6S7j

## Chạy thử trên máy

Toàn bộ game nằm trong một file `dau-truong-khoi.html`. Three.js r128 được tải từ cdnjs, nên máy cần có mạng.

```bash
python3 -m http.server 8000
```

Mở http://localhost:8000/dau-truong-khoi.html. Game cần chuột và bàn phím.

Khi chạy trên máy, phần lưu kết quả lên kho chung không hoạt động, vì kho này chỉ có trên claude.ai. Nút "Sao chép kết quả" vẫn dùng được.

## Điều khiển

| Phím | Hành động |
|---|---|
| Chuột trái | Chém ngang |
| Cuộn lên / R | Đập thẳng |
| Cuộn xuống / E | Đâm xiên |
| Chuột phải / F (giữ) | Đỡ |
| Bấm đúng nút của đòn đối thủ ngay trước khi chạm | Phản đòn khớp loại |
| Đang vung, bấm nút đòn khác | Đổi đòn giữa chừng |
| Q | Nhử đòn |
| W A S D, Shift | Di chuyển, chạy |
| Esc | Tạm dừng, chỉnh thông số |
| M | Bật/tắt âm thanh |

## Cơ chế chiến đấu

Có ba tầng phòng thủ:

1. **Đỡ thường** (giữ chuột phải): đỡ được mọi đòn, nhưng tốn thể lực. Hết thể lực là vỡ thế.
2. **Đỡ chuẩn**: bấm đỡ trong khoảng 200 ms trước khi đòn chạm. Không tốn thể lực, nhưng không được phản đòn nhanh.
3. **Phản đòn khớp loại**: bấm đúng loại đòn đối thủ đang ra, trong khoảng 250 ms trước khi chạm. Đối thủ bị bật đòn và đòn của bạn ra rất nhanh. Bấm sai loại thì ăn đòn.

Thời gian từ lúc vung tới lúc chạm (kiếm / rìu):

| Đòn | Kiếm | Rìu |
|---|---|---|
| Đâm xiên | 0,55 giây | 0,60 giây |
| Chém ngang | 0,60 giây | 0,70 giây |
| Đập thẳng | 0,75 giây | 0,86 giây |

Bot có ba mức:
- **Dễ**: chỉ chém.
- **Vừa**: biết đỡ, đôi khi phản đòn.
- **Khó**: phản đòn, nhử đòn và đổi đòn.

Các thông số chính (khoảng đỡ, khoảng phản đòn, tốc độ đòn, sát thương, hồi thể lực, phản xạ bot) chỉnh trực tiếp trong game, bằng bảng mở bằng phím Esc.

## Dành cho tester

- **Phòng tập phản đòn**: tập riêng từng loại đòn. Sau mỗi lần thử, game báo đúng hay sai loại, và bấm sớm hay muộn bao nhiêu ms.
- **Cuối mỗi trận**: trả lời câu hỏi "Muốn đánh thêm trận nữa không?" và ghi góp ý.
- **Người cùng tổ chức claude.ai**: kết quả tự lưu.
- **Người ngoài tổ chức**: bấm "Sao chép kết quả" rồi gửi qua nhóm chat. Người làm game dán vào mục "Kết quả tester" để gộp số liệu.

## Trạng thái

Đang ở Giai đoạn 1 (prototype chiến đấu 1v1 với bot) và chuẩn bị chơi thử để xét cổng. Sau khi qua cổng, dự án sẽ chuyển sang Vite + TypeScript và tách code chiến đấu thành module riêng, theo lộ trình.
