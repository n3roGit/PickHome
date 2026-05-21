#!/bin/sh
set -e

DATA_DIR="/app/data"
mkdir -p "$DATA_DIR/uploads/apartments"

echo "[pickhome] entrypoint uid=$(id -u) user=$(id -un 2>/dev/null || echo unknown)"

fix_data_permissions() {
  if [ "$(id -u)" != "0" ]; then
    return 0
  fi
  chown -R node:node "$DATA_DIR" 2>/dev/null || true
}

run_server() {
  if [ "$(id -u)" = "0" ] && su node -s /bin/sh -c "test -w ${DATA_DIR}" 2>/dev/null; then
    exec su node -s /bin/sh -c "exec node server.js"
  fi
  if [ "$(id -u)" = "0" ]; then
    echo "[pickhome] WARN: /app/data not writable as node — starting app as root (on host: chown -R 1000:1000 ./data)"
  fi
  exec node server.js
}

if [ "$(id -u)" = "0" ]; then
  echo "[pickhome] Running database auto-update as root (bind-mounted ./data)..."
  node scripts/db-autoupdate.mjs
  fix_data_permissions
  run_server
fi

echo "[pickhome] WARN: container not running as root — db-autoupdate uses current uid (compose user: overrides entrypoint)"
node scripts/db-autoupdate.mjs
run_server
