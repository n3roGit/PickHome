import { join } from "path";
import { exportBackupFileName, exportBackupToFile } from "../src/lib/backup";
import { getPickHomeDataDir } from "../src/lib/pickhome-data";

async function main() {
  const dataDir = getPickHomeDataDir();
  const target =
    process.argv[2] ?? join(dataDir, "backups", exportBackupFileName());
  await exportBackupToFile(target);
  console.log(`Backup written to ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
