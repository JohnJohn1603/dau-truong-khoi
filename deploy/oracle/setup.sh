#!/usr/bin/env bash
# Cài máy chủ phòng Đấu Trường Khối lên một máy ảo Oracle Cloud Always Free (Canonical Ubuntu 24.04, AMD hoặc ARM).
# Chạy một lần trên máy ảo, với quyền sudo:
#   sudo DOMAIN=ten-ban.duckdns.org DUCKDNS_TOKEN=xxxx bash setup.sh
# Chạy lại nhiều lần vẫn an toàn. Kết quả:
#   - Node.js 20 ở /opt/node, mã nguồn ở /opt/dtk, dịch vụ systemd "dtk" (cổng 8787, chỉ nghe 127.0.0.1)
#   - Caddy nhận wss://DOMAIN (cổng 443), tự xin chứng chỉ TLS miễn phí, chuyển vào cổng 8787
#   - Tường lửa trong máy mở cổng 80 và 443
#   - DuckDNS: cứ 5 phút cập nhật IP của máy cho tên miền
set -euo pipefail

: "${DOMAIN:?Thiếu DOMAIN, ví dụ DOMAIN=dtk-arena.duckdns.org}"
DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-}"
REPO="${REPO:-https://github.com/JohnJohn1603/dau-truong-khoi.git}"
NODE_VERSION="20.18.1"
APP_DIR=/opt/dtk

[ "$(id -u)" = 0 ] || { echo "Cần chạy bằng sudo."; exit 1; }

echo "== 1/6 Gói hệ thống"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl ca-certificates xz-utils caddy iptables-persistent

echo "== 2/6 Node.js $NODE_VERSION"
case "$(uname -m)" in
  x86_64) ARCH=x64 ;;
  aarch64) ARCH=arm64 ;;
  *) echo "Kiến trúc lạ: $(uname -m)"; exit 1 ;;
esac
if [ "$(/opt/node/bin/node -v 2>/dev/null || true)" != "v$NODE_VERSION" ]; then
  TMP=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.xz" -o "$TMP/node.tar.xz"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  (cd "$TMP" && grep " node-v$NODE_VERSION-linux-$ARCH.tar.xz\$" SHASUMS256.txt | sed "s|node-v.*|node.tar.xz|" | sha256sum -c -)
  rm -rf /opt/node && mkdir -p /opt/node
  tar -xJf "$TMP/node.tar.xz" -C /opt/node --strip-components=1
  rm -rf "$TMP"
fi
export PATH=/opt/node/bin:$PATH

echo "== 3/6 Mã nguồn và thư viện"
id dtk >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin dtk
if [ ! -d "$APP_DIR/.git" ]; then git clone --depth 1 "$REPO" "$APP_DIR"; fi
chown -R dtk:dtk "$APP_DIR"
sudo -u dtk git -C "$APP_DIR" pull --ff-only
sudo -u dtk env PATH="$PATH" HOME="$APP_DIR" bash -c "cd '$APP_DIR' && npm ci -w server --include-workspace-root --no-audit --no-fund"

echo "== 4/6 Dịch vụ systemd"
install -m 644 "$APP_DIR/deploy/oracle/dtk.service" /etc/systemd/system/dtk.service
systemctl daemon-reload
systemctl enable --now dtk
systemctl restart dtk

echo "== 5/6 Caddy (HTTPS / WSS) và tường lửa"
sed "s|{\$DOMAIN}|$DOMAIN|" "$APP_DIR/deploy/oracle/Caddyfile" > /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy
# Ảnh Ubuntu của Oracle chặn mọi cổng trừ 22 bằng một luật REJECT; chèn luật mở 80 và 443 lên trước luật đó.
for p in 80 443; do
  iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null && continue
  n=$(iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{print $1; exit}')
  if [ -n "$n" ]; then iptables -I INPUT "$n" -p tcp --dport "$p" -m state --state NEW -j ACCEPT
  else iptables -A INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT; fi
done
netfilter-persistent save

echo "== 6/6 DuckDNS"
if [ -n "$DUCKDNS_TOKEN" ]; then
  SUB="${DOMAIN%.duckdns.org}"
  cat > /etc/cron.d/duckdns <<EOF
*/5 * * * * root curl -fsS "https://www.duckdns.org/update?domains=$SUB&token=$DUCKDNS_TOKEN&ip=" -o /var/log/duckdns.log
EOF
  chmod 600 /etc/cron.d/duckdns
  curl -fsS "https://www.duckdns.org/update?domains=$SUB&token=$DUCKDNS_TOKEN&ip=" && echo " (DuckDNS)"
else
  echo "Không có DUCKDNS_TOKEN: bỏ qua, nhớ trỏ $DOMAIN về IP công khai của máy."
fi

systemctl restart caddy # lúc này tường lửa và tên miền đã sẵn sàng để xin chứng chỉ

echo
echo "Xong. Kiểm tra:  curl -s http://127.0.0.1:8787   và từ máy khác:  https://$DOMAIN/"
echo "Địa chỉ máy chủ cho trang game:  wss://$DOMAIN"
