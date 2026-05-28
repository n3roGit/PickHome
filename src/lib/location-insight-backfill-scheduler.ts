const CHECK_INTERVAL_MS = 90_000;
const STARTUP_DELAY_MS = 75_000;

let schedulerStarted = false;

export function startLocationInsightBackfillScheduler() {
  if (schedulerStarted) return;
  if (process.env.PICKHOME_LOCATION_INSIGHT_BACKFILL === "0") return;
  schedulerStarted = true;

  const tick = async () => {
    try {
      const { runLocationInsightBackfillTick } = await import(
        "@/lib/location-insight-backfill"
      );
      const result = await runLocationInsightBackfillTick();
      if (result.fetched > 0) {
        console.log(
          `[pickhome] Location insights: ${result.fetched} domain(s) updated` +
            (result.stoppedEarly ? " (paused — API cooldown)" : "") +
            "."
        );
      }
    } catch (error) {
      console.error("[pickhome] Location insight backfill failed:", error);
    }
  };

  setTimeout(tick, STARTUP_DELAY_MS);
  setInterval(tick, CHECK_INTERVAL_MS);
}

export function resetLocationInsightBackfillSchedulerForTests() {
  schedulerStarted = false;
}
