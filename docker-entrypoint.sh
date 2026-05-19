#!/bin/sh
set -e

node scripts/db-autoupdate.mjs

exec npx next start -H 0.0.0.0 -p 3000
