import { importBackupFromFile } from "../src/lib/backup";

async function main() {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error("Usage: npx tsx scripts/backup-import.ts <backup.zip> [--keep]");
    process.exit(1);
  }

  const keepPrevious = process.argv.includes("--keep");
  await importBackupFromFile(zipPath, { keepPrevious });
  console.log("Import complete. Restart PickHome (e.g. docker compose restart).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
