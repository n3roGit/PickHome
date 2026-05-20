import { computeCommuteLegs, type CommuteLeg } from "@/lib/commute";
import { invalidateCommuteCacheForProject } from "@/lib/commute-cache";
import { prisma } from "@/lib/prisma";
import type { RoutePoint } from "@/lib/routing";
import { parseTravelMode } from "@/lib/travel-mode";

export type ReindexProjectCommuteResult = {
  apartmentsTotal: number;
  apartmentsWithCoords: number;
  routesComputed: number;
  routesSkipped: number;
  routesFailed: number;
};

function countLegOutcome(leg: CommuteLeg): "computed" | "skipped" | "failed" {
  if (!leg.unavailableReason) return "computed";
  if (leg.unavailableReason === "routing_failed") return "failed";
  return "skipped";
}

export async function reindexProjectCommute(projectId: string): Promise<ReindexProjectCommuteResult> {
  await invalidateCommuteCacheForProject(projectId);

  const [apartments, members] = await Promise.all([
    prisma.apartment.findMany({
      where: { projectId, archivedAt: null },
      select: { id: true, latitude: true, longitude: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: {
        user: {
          select: {
            travelMode: true,
            addresses: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          },
        },
      },
    }),
  ]);

  const memberInputs = members.map((m) => ({
    travelMode: parseTravelMode(m.user.travelMode),
    addresses: m.user.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      address: a.address,
      latitude: a.latitude,
      longitude: a.longitude,
    })),
  }));

  let routesComputed = 0;
  let routesSkipped = 0;
  let routesFailed = 0;
  let apartmentsWithCoords = 0;

  for (const apt of apartments) {
    const apartment: RoutePoint | null =
      apt.latitude != null && apt.longitude != null
        ? { latitude: apt.latitude, longitude: apt.longitude }
        : null;

    if (!apartment) {
      for (const member of memberInputs) {
        for (const _addr of member.addresses) {
          routesSkipped += 1;
        }
      }
      continue;
    }

    apartmentsWithCoords += 1;

    for (const member of memberInputs) {
      if (member.addresses.length === 0) continue;

      const legs = await computeCommuteLegs({
        apartmentId: apt.id,
        apartment,
        addresses: member.addresses,
        travelMode: member.travelMode,
      });

      for (const leg of legs) {
        const outcome = countLegOutcome(leg);
        if (outcome === "computed") routesComputed += 1;
        else if (outcome === "failed") routesFailed += 1;
        else routesSkipped += 1;
      }
    }
  }

  return {
    apartmentsTotal: apartments.length,
    apartmentsWithCoords,
    routesComputed,
    routesSkipped,
    routesFailed,
  };
}
