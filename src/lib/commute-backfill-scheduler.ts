const CHECK_INTERVAL_MS = 120_000;
const STARTUP_DELAY_MS = 45_000;

let schedulerStarted = false;
let tickInProgress = false;

export function startCommuteBackfillScheduler() {
  if (schedulerStarted) return;
  if (process.env.PICKHOME_COMMUTE_BACKFILL === "0") return;
  schedulerStarted = true;

  const tick = async () => {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
      const { runCommuteBackfillTick } = await import("@/lib/commute-backfill");
      const result = await runCommuteBackfillTick();
      if (result.computed > 0) {
        console.log(
          `[pickhome] Commute backfill: ${result.computed} route(s) computed` +
            (result.skipped > 0 ? `, ${result.skipped} skipped` : "") +
            (result.stoppedEarly ? " (paused — API cooldown)" : "") +
            "."
        );
      }
    } catch (error) {
      console.error("[pickhome] Commute backfill failed:", error);
    } finally {
      tickInProgress = false;
    }
  };

  setTimeout(tick, STARTUP_DELAY_MS);
  setInterval(tick, CHECK_INTERVAL_MS);
}

export function resetCommuteBackfillSchedulerForTests() {
  schedulerStarted = false;
  tickInProgress = false;
}
