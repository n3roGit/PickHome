import { backfillSizeSqmFromDescriptions } from "../src/lib/backfill-size-sqm.ts";

const updated = await backfillSizeSqmFromDescriptions();
if (updated > 0) {
  console.log(`[pickhome] Backfilled sizeSqm for ${updated} apartment(s).`);
}
