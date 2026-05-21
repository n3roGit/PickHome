#!/bin/sh
set -e

DATA_DIR="/app/data"
mkdir -p "$DATA_DIR/uploads/apartments"

# Best-effort: bind mounts on some hosts ignore chown until files exist.
fix_data_permissions() {
  if [ "$(id -u)" != "0" ]; then
    return 0
  fi
  chown -R node:node "$DATA_DIR" 2>/dev/null || true
}

if [ "$(id -u)" = "0" ]; then
  echo "[pickhome] Running database auto-update as root (bind-mounted ./data)..."
  node scripts/db-autoupdate.mjs
  fix_data_permissions
  if su node -s /bin/sh -c "test -w ${DATA_DIR}" 2>/dev/null; then
    exec su node -s /bin/sh -c "exec node server.js"
  fi
  echo "[pickhome] WARN: /app/data not writable as node — starting app as root (fix host ownership of ./data)"
  exec node server.js
fi

node scripts/db-autoupdate.mjs
exec node server.js
