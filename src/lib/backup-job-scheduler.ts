const CHECK_INTERVAL_MS = 60_000;

let schedulerStarted = false;
let checkInProgress = false;

export function startBackupJobScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const tick = async () => {
    if (checkInProgress) return;
    checkInProgress = true;
    try {
      const { runScheduledBackupIfDue } = await import("@/lib/backup-jobs");
      const ran = await runScheduledBackupIfDue();
      if (ran) {
        console.log("[pickhome] Scheduled backup completed.");
      }
    } catch (error) {
      console.error("[pickhome] Scheduled backup failed:", error);
    } finally {
      checkInProgress = false;
    }
  };

  setTimeout(tick, 10_000);
  setInterval(tick, CHECK_INTERVAL_MS);
}
