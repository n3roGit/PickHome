import { runScheduledBackupIfDue } from "../src/lib/backup-jobs.ts";

const ran = await runScheduledBackupIfDue();
if (ran) {
  console.log("[pickhome] Scheduled backup completed.");
} else {
  console.log("[pickhome] No scheduled backup due.");
}
