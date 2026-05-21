#!/bin/sh
set -e

node scripts/db-autoupdate.mjs

exec node server.js
