#!/bin/sh
set -e

mkdir -p /app/data/uploads/apartments

if [ ! -f /app/data/pickhome.db ]; then
  echo "Initializing database..."
fi

npx prisma db push
npx tsx prisma/seed.ts

exec npm run start -- -H 0.0.0.0 -p 3000
