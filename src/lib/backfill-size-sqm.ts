import { prisma } from "@/lib/prisma";
import { parseSqmFromText } from "@/lib/listing-import";

/** Copy m² from description/notes into sizeSqm when the column is still empty. */
export async function backfillSizeSqmFromDescriptions(): Promise<number> {
  const rows = await prisma.apartment.findMany({
    where: { sizeSqm: null },
    select: { id: true, description: true, notes: true },
  });

  let updated = 0;
  for (const row of rows) {
    const blob = [row.description, row.notes].filter(Boolean).join("\n");
    const sizeSqm = parseSqmFromText(blob);
    if (sizeSqm == null) continue;
    await prisma.apartment.update({
      where: { id: row.id },
      data: { sizeSqm },
    });
    updated++;
  }
  return updated;
}
