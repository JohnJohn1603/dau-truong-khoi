# Đấu Trường Khối

Game đấu kiếm sinh tồn góc nhìn thứ nhất, đồ hoạ voxel, chạy trên trình duyệt. Hiện có đấu tay đôi với bot, đánh tự do 3 người (bạn và 2 bot) và phòng tập phản đòn. Thắng 3 hiệp trước là thắng trận.

- **Trang game (chơi qua mạng được):** https://johnjohn1603.github.io/dau-truong-khoi/
- **Bản trên claude.ai (chỉ chơi với bot):** https://claude.ai/artifact/5U3VY2e5M5hA5eaqv9Uens
- **Lộ trình phát triển:** https://claude.ai/artifact/5hR5UfkL8GRr3q8JhR6S7j

## Chạy trên máy

Cần Node.js 18 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Game cần chuột và bàn phím.

Các lệnh khác:

| Lệnh | Việc |
|---|---|
| `npm run build` | Build client ra `client/dist/` (bản đưa lên claude.ai, sau này GitHub Pages) |
| `npm run server` | Chạy máy chủ phòng chơi qua mạng ở `ws://localhost:8787` |
| `npm run sim` | Chạy một trận đánh tự do 3 người trên Node.js, không cần trình duyệt, và kiểm tra tính tất định |
| `npm run typecheck` | Kiểm tra kiểu TypeScript cho `shared/` và `server/` |

Khi chạy trên máy, phần lưu kết quả lên kho chung không hoạt động, vì kho này chỉ có trên claude.ai. Nút "Sao chép kết quả" vẫn dùng được.

## Cấu trúc thư mục

```
shared/src/      Lõi chiến đấu dùng chung, TypeScript, không phụ thuộc trình duyệt hay Three.js
  data.ts        Bảng vũ khí, cấu hình bot, thông số chỉnh được, hằng số (bước 60 Hz, giới hạn xoay…)
  sim.ts         Mô phỏng: người đấu, luật vung / đổi đòn / nhử / đỡ / phản đòn / lách / trúng đòn, hiệp và trận
  ai.ts          Bộ não bot 3 mức, tự chọn mục tiêu
  arena.ts       Va chạm với tường và cột
  rng.ts         Số ngẫu nhiên có hạt giống (cùng hạt giống → cùng kết quả)
client/          Dự án Vite: trang game chạy trên trình duyệt
  index.html     Khung trang: HUD, menu, phòng tập, màn hình cuối trận, trang kết quả
  src/core.js    Cầu nối tới lõi chiến đấu (một Sim duy nhất)
  src/effects.js Âm thanh, hạt, HUD, và xử lý sự kiện từ lõi (trúng, đỡ, phản đòn…)
  src/…          Cảnh, mô hình hiệp sĩ, điều khiển, luồng trận, phòng tập, kết quả tester, menu, vòng lặp
server/src/      Phần chạy trên Node.js; hiện có headless.ts để chạy trận không cần trình duyệt
```

Lõi chiến đấu không tự vẽ hay phát âm thanh. Nó chỉ báo ra **sự kiện** (`swing`, `hit`, `counter`, `perfect`, `dodge`, `roundEnd`…), và client quyết định hiển thị thế nào. Máy chủ ở bước 3 sẽ chạy đúng lõi này và gửi các sự kiện đó cho người chơi.

Muốn chỉnh cân bằng thì sửa `WEAPONS` (thời gian vung, sát thương, tầm đánh, thể lực) và `BOT_CFG` (độ khó bot) trong `shared/src/data.ts`.

## Chơi qua mạng (thử trên máy)

1. Mở hai terminal trong thư mục dự án. Một bên chạy `npm run server`, bên kia chạy `npm run dev`.
2. Mở http://localhost:5173 ở 2–3 cửa sổ trình duyệt, nhập tên khác nhau.
3. Cửa sổ thứ nhất: **Chơi qua mạng**, rồi **Tạo phòng**, nhận mã 4 ký tự. Các cửa sổ khác nhập mã đó rồi bấm **Vào phòng**.
4. Chủ phòng chọn độ khó bot rồi bấm **Bắt đầu**. Chỗ trống do bot đánh thay. Ai rời giữa trận thì bot điều khiển thay người đó.

Muốn bạn bè ở máy khác vào được thì máy chủ phải đặt trên mạng (bước 4 của kế hoạch: Fly.io Singapore, trang game trên GitHub Pages). Link claude.ai không kết nối được tới máy chủ ngoài, nên ở đó chỉ chơi được với bot.

Cách máy chủ giữ công bằng:
- Máy chủ quyết định mọi thứ. Người chơi chỉ gửi thao tác.
- Thao tác phòng thủ (đỡ, phản đòn, lách) được lùi thời điểm theo độ trễ của người bấm, tối đa 150 ms. Đòn trúng người chơi thật cũng được xét muộn đúng chừng ấy để những thao tác đó kịp tính.
- Máy của bạn tự dự đoán chuyển động và đòn của chính bạn, nên thấy ngay, rồi khớp lại theo máy chủ. Người khác hiển thị chậm 100 ms, nội suy giữa các ảnh chụp trạng thái (20 lần/giây).

## Triển khai

Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/deploy.yml`) làm ba việc:
1. kiểm tra kiểu và chạy một trận mô phỏng trên Node
2. build trang game và đăng lên GitHub Pages, với địa chỉ máy chủ `wss://dtk-arena-sin.fly.dev` gắn sẵn
3. triển khai máy chủ phòng lên Fly.io, vùng Singapore (`fly.toml`, `Dockerfile`), nếu repo có secret `FLY_API_TOKEN`

Máy chủ dùng một máy duy nhất, tự tắt khi không ai chơi và tự bật khi có người kết nối. Lần kết nối đầu sau khi máy tắt sẽ chậm vài giây. Trang `https://dtk-arena-sin.fly.dev/` cho biết số phòng và số người đang chơi.

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
| Nhấn đúp A / D | Lách trái / phải |
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
- **Khó**: phản đòn, nhử đòn, đổi đòn và lách.

Các thông số chính (khoảng đỡ, khoảng phản đòn, tốc độ đòn, sát thương, hồi thể lực, phản xạ bot) chỉnh trực tiếp trong game, bằng bảng mở bằng phím Esc.

## Dành cho tester

- **Phòng tập phản đòn**: tập riêng từng loại đòn. Sau mỗi lần thử, game báo đúng hay sai loại, và bấm sớm hay muộn bao nhiêu ms.
- **Cuối mỗi trận**: trả lời câu hỏi "Muốn đánh thêm trận nữa không?" và ghi góp ý.
- **Người cùng tổ chức claude.ai**: kết quả tự lưu.
- **Người ngoài tổ chức**: bấm "Sao chép kết quả" rồi gửi qua nhóm chat. Người làm game dán vào mục "Kết quả tester" để gộp số liệu.

## Trạng thái

- Giai đoạn 1 (chiến đấu 1v1 với bot): đang chơi thử để xét cổng.
- Giai đoạn 3a (phòng 3 người đánh tự do qua mạng): đã xong bước 1 (lõi cho N người, 60 Hz, giả lập ping) và bước 2 (Vite + TypeScript, `shared/` `client/` `server/`). Bước 3 (máy chủ phòng 3 người, `server/src/server.ts`) đã chạy được trên máy. Bước tiếp theo là đưa lên mạng.
- Client vẫn viết bằng JavaScript (module ES). Phần dùng chung với máy chủ đã là TypeScript; client sẽ chuyển dần sang TypeScript.
