import { prisma } from "@/lib/prisma";

/** Map legacy checklist statuses to the 3-state model (idempotent). */
export async function backfillChecklistStatus(): Promise<number> {
  const openRows = await prisma.checklistEntry.updateMany({
    where: { status: "open" },
    data: { status: "not_ok" },
  });
  const naRows = await prisma.checklistEntry.updateMany({
    where: { status: "na" },
    data: { status: "unset" },
  });
  return openRows.count + naRows.count;
}
