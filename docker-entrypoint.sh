#!/bin/sh
set -e

DATA_DIR="/app/data"
mkdir -p "$DATA_DIR/uploads/apartments"

run_app() {
  node scripts/db-autoupdate.mjs
  exec node server.js
}

# Bind-mounted ./data is often root-owned on the host; SQLite needs write on the directory and DB file.
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "$DATA_DIR"
  exec su node -s /bin/sh -c "node scripts/db-autoupdate.mjs && exec node server.js"
fi

run_app
