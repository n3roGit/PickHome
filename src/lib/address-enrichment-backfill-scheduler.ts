const CHECK_INTERVAL_MS = 180_000;
const STARTUP_DELAY_MS = 90_000;

let schedulerStarted = false;
let tickInProgress = false;

export function startAddressEnrichmentBackfillScheduler() {
  if (schedulerStarted) return;
  if (process.env.PICKHOME_ADDRESS_ENRICHMENT === "0") return;
  schedulerStarted = true;

  const tick = async () => {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
      const { runAddressEnrichmentBackfillTick } = await import(
        "@/lib/apartment-address-enrichment"
      );
      const result = await runAddressEnrichmentBackfillTick();
      if (result.updated > 0) {
        console.log(
          `[pickhome] Address enrichment: ${result.updated} apartment(s) updated` +
            (result.stoppedEarly ? " (paused — Nominatim cooldown)" : "") +
            "."
        );
      }
    } catch (error) {
      console.error("[pickhome] Address enrichment backfill failed:", error);
    } finally {
      tickInProgress = false;
    }
  };

  setTimeout(tick, STARTUP_DELAY_MS);
  setInterval(tick, CHECK_INTERVAL_MS);
}

export function resetAddressEnrichmentBackfillSchedulerForTests() {
  schedulerStarted = false;
  tickInProgress = false;
}
