export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupJobScheduler } = await import("@/lib/backup-job-scheduler");
    startBackupJobScheduler();
  }
}
