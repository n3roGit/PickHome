import { getAppTimeZone } from "@/lib/app-settings";

/** Poll at most hourly; actual price fetch runs once per day (see isListingPriceSyncDue). */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_DELAY_MS = 90_000;

let schedulerStarted = false;
let tickInProgress = false;

export function startListingPriceSyncScheduler() {
  if (schedulerStarted) return;
  if (process.env.PICKHOME_LISTING_PRICE_SYNC === "0") return;
  schedulerStarted = true;

  const tick = async () => {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
      const {
        runListingPriceSyncTick,
        isListingPriceSyncDue,
        countApartmentsDueForListingPriceCheck,
        getOrCreateListingPriceSyncJobSettings,
      } = await import("@/lib/listing-price-sync");

      const settings = await getOrCreateListingPriceSyncJobSettings();
      const timeZone = await getAppTimeZone();
      const now = new Date();
      const due = isListingPriceSyncDue(settings, now, timeZone);
      const pending = await countApartmentsDueForListingPriceCheck(settings, now, timeZone);

      if (!due && pending === 0) return;

      const result = await runListingPriceSyncTick();
      if (result.updated > 0) {
        console.log(
          `[pickhome] Listing price sync: ${result.updated} price update(s)` +
            (result.failed > 0 ? `, ${result.failed} failed` : "") +
            (result.cycleComplete ? "" : " (cycle continues)") +
            "."
        );
      }
    } catch (error) {
      console.error("[pickhome] Listing price sync failed:", error);
    } finally {
      tickInProgress = false;
    }
  };

  setTimeout(tick, STARTUP_DELAY_MS);
  setInterval(tick, CHECK_INTERVAL_MS);
}

export function resetListingPriceSyncSchedulerForTests() {
  schedulerStarted = false;
  tickInProgress = false;
}
