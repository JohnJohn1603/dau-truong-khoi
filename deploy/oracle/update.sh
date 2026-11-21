#!/usr/bin/env bash
# Cập nhật máy chủ lên bản mới nhất trên GitHub. Chạy trên máy ảo:  sudo bash /opt/dtk/deploy/oracle/update.sh
set -euo pipefail
export PATH=/opt/node/bin:$PATH
sudo -u dtk git -C /opt/dtk pull --ff-only
sudo -u dtk env PATH="$PATH" HOME=/opt/dtk bash -c "cd /opt/dtk && npm ci -w server --include-workspace-root --no-audit --no-fund"
systemctl restart dtk
sleep 2
curl -s http://127.0.0.1:8787 && echo
