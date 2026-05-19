#!/bin/sh
set -e

node scripts/db-autoupdate.mjs

exec npm run start -- -H 0.0.0.0 -p 3000
