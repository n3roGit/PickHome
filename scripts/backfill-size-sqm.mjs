/**
 * One-off: copy m² from description/notes into sizeSqm when the column is empty.
 * Usage: npx tsx scripts/backfill-size-sqm.mjs
 */
import { PrismaClient } from "@prisma/client";
import { parseSqmFromText } from "../src/lib/listing-import.ts";

const prisma = new PrismaClient();

const rows = await prisma.apartment.findMany({
  where: { sizeSqm: null },
  select: { id: true, title: true, description: true, notes: true },
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
  console.log("updated:", row.title?.slice(0, 60), "->", sizeSqm, "m²");
  updated++;
}

console.log(`Done. ${updated} of ${rows.length} apartments without sizeSqm updated.`);
await prisma.$disconnect();
