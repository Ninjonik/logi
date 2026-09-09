#!/usr/bin/env bash
# Run on the VPS as root after copying both scripts there.
set -Eeuo pipefail

readonly SOURCE_TOOLKIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/logi-convex-backup"
readonly TARGET_TOOLKIT="/usr/local/sbin/logi-convex-backup"
readonly CRON_FILE="/etc/cron.d/logi-convex-backup"

[[ "${EUID}" -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
[[ -f "$SOURCE_TOOLKIT" ]] || { echo "Missing $SOURCE_TOOLKIT" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
docker inspect convex-backend-1 >/dev/null 2>&1 || {
  echo "The original convex-backend-1 container was not found. Nothing was changed." >&2
  exit 1
}

install -m 700 "$SOURCE_TOOLKIT" "$TARGET_TOOLKIT"
install -d -m 700 /docker/backups/convex
install -d -m 700 /var/lib/logi-convex-backup
printf '{"name":"logi-convex-backup","private":true,"dependencies":{"convex":"1.45.0"}}\n' >/var/lib/logi-convex-backup/package.json
chmod 600 /var/lib/logi-convex-backup/package.json
npm install --omit=dev --ignore-scripts --no-audit --no-fund --prefix /var/lib/logi-convex-backup
chmod -R go-rwx /var/lib/logi-convex-backup
cat >"$CRON_FILE" <<'EOF'
# Original Logi Convex only. Runs only after interactive setup creates its root-only config.
17 3 * * * root test -s /etc/logi/convex-backup.env && /usr/local/sbin/logi-convex-backup backup >>/var/log/logi-convex-backup.log 2>&1
EOF
chmod 644 "$CRON_FILE"
touch /var/log/logi-convex-backup.log
chmod 600 /var/log/logi-convex-backup.log
echo "Installed $TARGET_TOOLKIT and daily cron schedule (03:17 server time)."
echo "Next: run 'logi-convex-backup' and choose option 1 to enter the admin key securely."
