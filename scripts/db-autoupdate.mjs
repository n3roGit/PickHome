import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const RETRIES = 5;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function spawnCommand(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
}

function run(command, args) {
  const result = spawnCommand(command, args);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function ensureDataDirs() {
  const dataDir = process.env.PICKHOME_DATA_DIR
    ? join(process.cwd(), process.env.PICKHOME_DATA_DIR)
    : join(process.cwd(), "data");
  await mkdir(join(dataDir, "uploads", "apartments"), { recursive: true });
}

async function pushSchemaWithRetry() {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    console.log(`[pickhome] Applying database schema (attempt ${attempt}/${RETRIES})...`);
    const result = spawnCommand("npx", [
      "prisma",
      "db",
      "push",
      "--skip-generate",
      "--accept-data-loss",
    ]);
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
  run("npx", ["tsx", "scripts/backfill-size-sqm.mjs"]);

  if (isNewDatabase) {
    console.log("[pickhome] Seeding initial admin user...");
    run("npx", ["tsx", "prisma/seed.ts"]);
  }
}

main().catch((error) => {
  console.error("[pickhome] Database auto-update failed:", error);
  process.exit(1);
});
