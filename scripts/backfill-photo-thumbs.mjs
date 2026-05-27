import backfill from "../src/lib/backfill-photo-thumbs.ts";

const updated = await backfill.backfillPhotoThumbs();
if (updated > 0) {
  console.log(`[pickhome] Backfilled photo thumbnails for ${updated} photo(s).`);
}
