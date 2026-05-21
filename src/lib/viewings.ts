import { prisma } from "./prisma";

export async function syncApartmentViewedAt(apartmentId: string) {
  const now = new Date();
  const latestPast = await prisma.viewingAppointment.findFirst({
    where: { apartmentId, scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "desc" },
  });
  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { viewedAt: latestPast?.scheduledAt ?? null, revision: { increment: 1 } },
  });
}

export function nextViewing(
  viewings: { scheduledAt: Date }[],
  now = new Date()
): Date | null {
  const upcoming = viewings
    .map((v) => v.scheduledAt)
    .filter((d) => d > now)
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}
