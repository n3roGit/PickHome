import { backfillAreaFilterOrtKeys } from "../src/lib/backfill-area-filter-ort-keys.ts";

const updated = await backfillAreaFilterOrtKeys();
if (updated > 0) {
  console.log(`[pickhome] Backfilled area filter ortKeys for ${updated} project(s).`);
}
