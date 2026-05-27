import backfill from "../src/lib/apartment-price-history.ts";

const updated = await backfill.backfillApartmentPriceHistorySnapshots();
if (updated > 0) {
  console.log(`[pickhome] Backfilled price history snapshots for ${updated} apartment(s).`);
}
