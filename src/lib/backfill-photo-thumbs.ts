import { generatePhotoThumbnailFromUrl } from "@/lib/apartment-media";
import { prisma } from "@/lib/prisma";

/** Generate WebP thumbnails for photos missing thumbUrl. Idempotent. */
export async function backfillPhotoThumbs(): Promise<number> {
  const rows = await prisma.apartmentPhoto.findMany({
    where: { thumbUrl: null },
    select: { id: true, url: true },
  });

  let updated = 0;
  for (const row of rows) {
    const thumbUrl = await generatePhotoThumbnailFromUrl(row.url);
    if (!thumbUrl) continue;
    await prisma.apartmentPhoto.update({
      where: { id: row.id },
      data: { thumbUrl },
    });
    updated++;
  }
  return updated;
}
