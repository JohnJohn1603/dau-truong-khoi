# Đưa máy chủ phòng lên Oracle Cloud Always Free (0 đồng)

Một phòng 5 người tốn rất ít tài nguyên. Mỗi ảnh chụp trạng thái khoảng 0,5 KB, gửi 20 lần mỗi giây tới mỗi người, nên cả phòng chỉ dùng khoảng 50 KB/s. Hạn mức miễn phí của Oracle là 10 TB mỗi tháng, dư hàng chục lần. CPU chỉ dùng vài phần trăm của máy nhỏ nhất.

## Nguyên tắc để không bao giờ mất tiền

1. **Giữ tài khoản ở mức Free Tier, không bấm "Upgrade to Pay As You Go".** Tài khoản Free Tier không thể bị tính tiền. Khi hết 30 ngày dùng thử (300 USD tín dụng), mọi thứ không thuộc Always Free sẽ bị dừng chứ không chuyển sang tính tiền.
2. **Chỉ tạo tài nguyên có nhãn "Always Free-eligible":**
   - Máy ảo: shape **VM.Standard.E2.1.Micro** (AMD, 1 GB RAM, được tối đa 2 máy), hoặc **VM.Standard.A1.Flex** (ARM, tổng tối đa 4 OCPU và 24 GB RAM). Với game này, 1 OCPU và 6 GB là quá đủ.
   - Ổ đĩa khởi động để mặc định (khoảng 47–50 GB). Tổng ổ đĩa miễn phí là 200 GB.
   - **Không** tạo Load Balancer, Database, hay máy có GPU. Cũng không chọn shape khác như "VM.Standard.E4/E5".
3. Nhận email báo khi có chi tiêu: vào **Billing → Budgets**, tạo ngân sách 1 USD.
4. Thẻ Visa/Mastercard chỉ dùng để xác minh danh tính. Oracle có thể giữ tạm một khoản nhỏ rồi hoàn lại.

**Đánh đổi của Free Tier:** Oracle có thể dừng máy Always Free nếu máy gần như không làm gì suốt 7 ngày (CPU, mạng và bộ nhớ đều rất thấp). Máy chủ game lúc không ai chơi thường rơi vào trường hợp này. Nếu máy bị dừng, vào Console bấm **Start**. Nếu máy bị xoá, tạo máy mới và chạy lại `setup.sh` (khoảng 10 phút). Nâng lên Pay As You Go thì hết bị dừng, nhưng khi đó tạo nhầm tài nguyên trả phí sẽ bị tính tiền thật. Vì yêu cầu là 0 đồng, **cứ ở Free Tier**.

## Bước 1. Tạo tài khoản

- Đăng ký ở https://signup.cloud.oracle.com/
- **Home Region chọn `Singapore (ap-singapore-1)`.** Vùng này gần Việt Nam nhất và không đổi được sau khi đăng ký. Máy Always Free chỉ tạo được ở Home Region.

## Bước 2. Tên miền miễn phí (DuckDNS)

Trang game chạy bằng `https`, nên trình duyệt chỉ cho kết nối máy chủ qua `wss://`. Muốn có `wss://` thì cần một tên miền để xin chứng chỉ.

1. Vào https://www.duckdns.org/ và đăng nhập bằng GitHub hoặc Google.
2. Tạo một tên phụ, ví dụ `dtk-arena`. Bạn sẽ có tên miền `dtk-arena.duckdns.org`.
3. Ghi lại **token** hiện ở đầu trang. Đừng đưa token này lên GitHub.

## Bước 3. Tạo máy ảo

**Compute → Instances → Create instance:**

- **Image:** Canonical Ubuntu **24.04**.
- **Shape:** `VM.Standard.A1.Flex` (1 OCPU, 6 GB). Nếu báo "Out of capacity", đổi sang `VM.Standard.E2.1.Micro`; game vẫn chạy tốt.
- **Networking:** để mặc định (tạo VCN mới) và bật **Assign a public IPv4 address**.
- **SSH keys:** tải khoá riêng về (hoặc dán khoá công khai `~/.ssh/id_ed25519.pub` của bạn).
- Bấm **Create** rồi ghi lại **Public IP**.

## Bước 4. Mở cổng 80 và 443 trên Oracle

**Networking → Virtual cloud networks →** (VCN của máy) **→ Security Lists → Default Security List → Add Ingress Rules**. Thêm 2 luật:

| Source CIDR | IP Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

Cổng 80 chỉ dùng để Let's Encrypt cấp chứng chỉ. Không cần mở cổng 8787: máy chủ game chỉ nghe trong máy, Caddy chuyển tiếp vào.

## Bước 5. Cài máy chủ

Từ máy của bạn:

```bash
ssh -i duong/dan/khoa-rieng.key ubuntu@IP_CONG_KHAI
```

Trên máy ảo (thay tên miền và token của bạn):

```bash
curl -fsSLO https://raw.githubusercontent.com/JohnJohn1603/dau-truong-khoi/main/deploy/oracle/setup.sh
sudo DOMAIN=dtk-arena.duckdns.org DUCKDNS_TOKEN=token-cua-ban bash setup.sh
```

Script sẽ cài Node.js 20 (tải từ nodejs.org, có kiểm tra checksum), mã nguồn, dịch vụ `dtk`, Caddy, mở tường lửa trong máy, và đặt lịch cập nhật IP cho DuckDNS.

Kiểm tra từ máy bạn: mở `https://dtk-arena.duckdns.org/`. Nếu thấy `{"ok":true,"rooms":0,"players":0}` là đã chạy.

## Bước 6. Gắn địa chỉ máy chủ vào trang game

Trên GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**:

- Name: `SERVER_URL`
- Value: `wss://dtk-arena.duckdns.org`

Sau đó push lên `main`, hoặc chạy lại workflow "Triển khai". Trang GitHub Pages sẽ tự kết nối tới máy chủ này. Trước khi có biến này, người chơi vẫn có thể dán địa chỉ `wss://…` vào ô địa chỉ máy chủ trong màn hình Chơi qua mạng.

## Cập nhật khi có code mới

```bash
ssh ubuntu@IP_CONG_KHAI 'sudo bash /opt/dtk/deploy/oracle/update.sh'
```

## Khi có sự cố

| Triệu chứng | Lệnh xem |
|---|---|
| Máy chủ game có chạy không | `systemctl status dtk` · `journalctl -u dtk -n 50` |
| Chứng chỉ / HTTPS lỗi | `journalctl -u caddy -n 50` (thường do chưa mở cổng 80/443 ở Security List, hoặc DuckDNS chưa trỏ đúng IP) |
| DuckDNS đã trỏ đúng IP chưa | `cat /var/log/duckdns.log` (phải là `OK`) · `getent hosts dtk-arena.duckdns.org` |
| Tường lửa trong máy | `sudo iptables -L INPUT -n --line-numbers` (luật ACCEPT 80/443 phải nằm trên luật REJECT) |
