import {
  beginBackgroundTask,
  backgroundThrottlePause,
  endBackgroundTask,
} from "@/lib/background-task";
import {
  isExternalServiceInCooldown,
  type ExternalService,
} from "@/lib/external-fetch";
import {
  isLocationInsightCacheFresh,
  refreshLocationInsight,
} from "@/lib/location-insight-cache";
import {
  LOCATION_INSIGHT_DOMAINS,
  type LocationInsightDomain,
} from "@/lib/location-insight-types";
import { fetchLocationInsightForDomain } from "@/lib/location-insights";
import { prisma } from "@/lib/prisma";

export const LOCATION_INSIGHT_BACKFILL_MAX_PER_TICK = 1;

const DOMAIN_SERVICE: Record<LocationInsightDomain, ExternalService> = {
  overpass: "overpass",
  noise: "noise",
  flood: "flood",
  air: "air",
  radon: "radon",
  micro: "overpass",
  climate: "climate",
};

const priorityApartmentIds = new Set<string>();
let tickInProgress = false;

export type LocationInsightBackfillTickResult = {
  fetched: number;
  skipped: number;
  stoppedEarly: boolean;
};

export function enqueueLocationInsightBackfill(apartmentId: string): void {
  priorityApartmentIds.add(apartmentId);
}

export function resetLocationInsightBackfillStateForTests(): void {
  priorityApartmentIds.clear();
  tickInProgress = false;
}

type BackfillWorkItem = {
  apartmentId: string;
  domain: LocationInsightDomain;
};

async function findStaleDomainForApartment(
  apartmentId: string
): Promise<BackfillWorkItem | null> {
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, archivedAt: null },
    select: { latitude: true, longitude: true },
  });
  if (apartment?.latitude == null || apartment.longitude == null) {
    return null;
  }

  const caches = await prisma.apartmentLocationInsightCache.findMany({
    where: { apartmentId },
    select: { domain: true, fetchedAt: true },
  });
  const byDomain = new Map(caches.map((row) => [row.domain, row.fetchedAt]));

  for (const domain of LOCATION_INSIGHT_DOMAINS) {
    const fetchedAt = byDomain.get(domain);
    if (!fetchedAt || !isLocationInsightCacheFresh(fetchedAt)) {
      return { apartmentId, domain };
    }
  }

  return null;
}

async function findNextBackfillWork(limit: number): Promise<BackfillWorkItem[]> {
  const work: BackfillWorkItem[] = [];

  while (priorityApartmentIds.size > 0 && work.length < limit) {
    const apartmentId = priorityApartmentIds.values().next().value;
    if (!apartmentId) break;
    priorityApartmentIds.delete(apartmentId);
    const item = await findStaleDomainForApartment(apartmentId);
    if (item) work.push(item);
  }

  if (work.length >= limit) return work;

  const apartments = await prisma.apartment.findMany({
    where: {
      archivedAt: null,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  for (const apt of apartments) {
    if (work.length >= limit) break;
    const item = await findStaleDomainForApartment(apt.id);
    if (item) work.push(item);
  }

  return work;
}

export async function runLocationInsightBackfillTick(): Promise<LocationInsightBackfillTickResult> {
  if (process.env.PICKHOME_LOCATION_INSIGHT_BACKFILL === "0") {
    return { fetched: 0, skipped: 0, stoppedEarly: false };
  }
  if (tickInProgress) {
    return { fetched: 0, skipped: 0, stoppedEarly: false };
  }
  tickInProgress = true;

  const work = await findNextBackfillWork(LOCATION_INSIGHT_BACKFILL_MAX_PER_TICK);
  if (work.length === 0) {
    tickInProgress = false;
    return { fetched: 0, skipped: 0, stoppedEarly: false };
  }

  let fetched = 0;
  let skipped = 0;
  let stoppedEarly = false;

  beginBackgroundTask();
  try {
    for (const item of work) {
      const service = DOMAIN_SERVICE[item.domain];
      if (isExternalServiceInCooldown(service)) {
        stoppedEarly = true;
        skipped += 1;
        break;
      }

      await refreshLocationInsight(prisma, item.apartmentId, item.domain, (lat, lng) =>
        fetchLocationInsightForDomain(item.domain, lat, lng, { background: true })
      );
      fetched += 1;
      await backgroundThrottlePause(500);
    }
  } finally {
    endBackgroundTask();
    tickInProgress = false;
  }

  return { fetched, skipped, stoppedEarly };
}
