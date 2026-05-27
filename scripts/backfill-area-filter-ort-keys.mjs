import backfill from "../src/lib/backfill-area-filter-ort-keys.ts";

const updated = await backfill.backfillAreaFilterOrtKeys();
if (updated > 0) {
  console.log(`[pickhome] Backfilled area filter ortKeys for ${updated} project(s).`);
}
