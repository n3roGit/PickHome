# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN apk add --no-cache openssl \
  && apk upgrade --no-cache
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS builder
COPY prisma ./prisma
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/pickhome.db"
RUN npx prisma generate \
  && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/pickhome.db"
ENV PICKHOME_DATA_DIR="/app/data"
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/src/data ./src/data
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
# Standalone trace omits tsx; copy runtime + deps from npm ci (used by backfill scripts).
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx
COPY --from=deps /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=deps /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=deps /app/node_modules/get-tsconfig ./node_modules/get-tsconfig

RUN chmod +x docker-entrypoint.sh \
  && npm install --no-save prisma@6.5.0 @prisma/client@6.5.0 \
  && npx prisma generate \
  && test -f node_modules/tsx/dist/loader.mjs \
  && npm cache clean --force \
  && chown -R node:node /app

# node:22-alpine defaults to USER node — override so entrypoint can migrate bind-mounted ./data.
USER root
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
