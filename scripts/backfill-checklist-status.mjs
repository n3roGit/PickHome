import backfill from "../src/lib/backfill-checklist-status.ts";

const updated = await backfill.backfillChecklistStatus();
if (updated > 0) {
  console.log(`[pickhome] Backfilled checklist status for ${updated} entry/entries.`);
}
