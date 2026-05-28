export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupJobScheduler } = await import("@/lib/backup-job-scheduler");
    startBackupJobScheduler();
    const { startCommuteBackfillScheduler } = await import("@/lib/commute-backfill-scheduler");
    startCommuteBackfillScheduler();
    const { startAddressEnrichmentBackfillScheduler } = await import(
      "@/lib/address-enrichment-backfill-scheduler"
    );
    startAddressEnrichmentBackfillScheduler();
    const { startListingPriceSyncScheduler } = await import(
      "@/lib/listing-price-sync-scheduler"
    );
    startListingPriceSyncScheduler();
    const { startLocationInsightBackfillScheduler } = await import(
      "@/lib/location-insight-backfill-scheduler"
    );
    startLocationInsightBackfillScheduler();
  }
}
