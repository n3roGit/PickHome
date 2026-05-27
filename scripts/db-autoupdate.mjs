import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const RETRIES = 5;
const RETRY_DELAY_MS = 2000;
const PRISMA_PUSH_ARGS = "db push --skip-generate --accept-data-loss";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function resolveDbFilePath() {
  const url =
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV === "production" ? "file:/app/data/pickhome.db" : undefined);
  if (!url?.startsWith("file:")) {
    throw new Error("db-autoupdate supports SQLite file: DATABASE_URL only");
  }
  const pathPart = url.slice("file:".length);
  if (pathPart.startsWith("/") || /^[A-Za-z]:/.test(pathPart)) {
    return pathPart;
  }
  return join(process.cwd(), "prisma", pathPart);
}

function runShell(command) {
  console.log(`[pickhome] > ${command}`);
  const result = spawnSync(command, {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? "unknown"}): ${command}`);
  }
}

/** Node 22 native .ts loading breaks named ESM imports — use tsx as a loader. */
function resolveTsxImport() {
  const rootLoader = join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs");
  if (existsSync(rootLoader)) return "tsx";
  const dbToolsLoader = join(
    process.cwd(),
    "db-tools",
    "node_modules",
    "tsx",
    "dist",
    "esm",
    "index.mjs"
  );
  if (existsSync(dbToolsLoader)) return dbToolsLoader;
  throw new Error("tsx not found (expected /app/node_modules/tsx in Docker image)");
}

function runTsxScript(scriptPath) {
  const tsxImport = resolveTsxImport();
  const absScript = join(process.cwd(), scriptPath);
  runShell(`node --import "${tsxImport}" "${absScript}"`);
}

function runTsxScriptOptional(label, scriptPath) {
  try {
    runTsxScript(scriptPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pickhome] ${label} skipped (${message})`);
  }
}

async function ensureDataDirs() {
  const dataDir = process.env.PICKHOME_DATA_DIR
    ? join(process.cwd(), process.env.PICKHOME_DATA_DIR)
    : join(process.cwd(), "data");
  await mkdir(join(dataDir, "uploads", "apartments"), { recursive: true });
}

function logRuntimeIdentity() {
  const uid = typeof process.getuid === "function" ? String(process.getuid()) : "unknown";
  const gid = typeof process.getgid === "function" ? String(process.getgid()) : "unknown";
  console.log(`[pickhome] db-autoupdate process uid=${uid} gid=${gid}`);
}

async function pushSchemaWithRetry() {
  const command = `npx prisma ${PRISMA_PUSH_ARGS}`;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    console.log(`[pickhome] Applying database schema (attempt ${attempt}/${RETRIES})...`);
    const result = spawnSync(command, {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
    if (result.status === 0) {
      console.log("[pickhome] Database schema is up to date.");
      return;
    }
    if (attempt === RETRIES) {
      throw new Error("prisma db push failed after retries");
    }
    console.warn(`[pickhome] db push failed, retrying in ${RETRY_DELAY_MS}ms...`);
    await sleep(RETRY_DELAY_MS);
  }
}

async function main() {
  console.log(`[pickhome] db-autoupdate v${appVersion()} (${PRISMA_PUSH_ARGS})`);
  logRuntimeIdentity();

  await ensureDataDirs();

  const dbPath = resolveDbFilePath();
  const isNewDatabase = !existsSync(dbPath);
  if (isNewDatabase) {
    console.log("[pickhome] No database file yet — will create and seed.");
  } else {
    console.log("[pickhome] Checking for schema updates...");
  }

  await pushSchemaWithRetry();

  console.log("[pickhome] Backfilling sizeSqm from descriptions (if needed)...");
  runTsxScriptOptional("Backfill sizeSqm", "scripts/backfill-size-sqm.mjs");

  console.log("[pickhome] Backfilling checklist status (if needed)...");
  runTsxScriptOptional("Backfill checklist status", "scripts/backfill-checklist-status.mjs");

  console.log("[pickhome] Backfilling area filter ortKeys (if needed)...");
  runTsxScriptOptional("Backfill area filter ortKeys", "scripts/backfill-area-filter-ort-keys.mjs");

  console.log("[pickhome] Backfilling apartment price history snapshots (if needed)...");
  runTsxScriptOptional(
    "Backfill apartment price history",
    "scripts/backfill-apartment-price-history.mjs"
  );

  console.log("[pickhome] Backfilling photo thumbnails (if needed)...");
  runTsxScriptOptional("Backfill photo thumbnails", "scripts/backfill-photo-thumbs.mjs");

  if (isNewDatabase) {
    console.log("[pickhome] Seeding initial admin user...");
    runTsxScript("prisma/seed.ts");
  }
}

main().catch((error) => {
  console.error("[pickhome] Database auto-update failed:", error);
  process.exit(1);
});
