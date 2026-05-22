import { nestedProjectAccessFilter, type ProjectAccessUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type { ViewingScheduleSlot } from "@/lib/viewing-schedule-conflicts";

export async function getProjectViewingScheduleSlots(
  projectId: string,
  user: ProjectAccessUser
): Promise<ViewingScheduleSlot[]> {
  const apartments = await prisma.apartment.findMany({
    where: { projectId, project: nestedProjectAccessFilter(user) },
    select: {
      id: true,
      title: true,
      address: true,
      latitude: true,
      longitude: true,
      viewings: {
        select: { id: true, scheduledAt: true },
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  return apartments.flatMap((apt) =>
    apt.viewings.map((v) => ({
      id: v.id,
      apartmentId: apt.id,
      apartmentTitle: apt.title,
      scheduledAt: v.scheduledAt,
      latitude: apt.latitude,
      longitude: apt.longitude,
      address: apt.address,
    }))
  );
}
