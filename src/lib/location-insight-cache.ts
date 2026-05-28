import type { PrismaClient } from "@prisma/client";
import {
  isLocationInsightDomain,
  type LocationInsightDomain,
  type LocationInsightStatus,
} from "@/lib/location-insight-types";

export const LOCATION_INSIGHT_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type LocationInsightSnapshot<T> = {
  domain: LocationInsightDomain;
  status: LocationInsightStatus;
  errorMessage: string | null;
  fetchedAt: Date;
  data: T | null;
};

type Fetcher<T> = (latitude: number, longitude: number) => Promise<
  | { ok: true; data: T; noData?: boolean }
  | { ok: false; error: string }
>;

function parsePayloadJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < LOCATION_INSIGHT_CACHE_TTL_MS;
}

async function persistSnapshot<T>(
  prisma: PrismaClient,
  apartmentId: string,
  domain: LocationInsightDomain,
  snapshot: LocationInsightSnapshot<T>
): Promise<LocationInsightSnapshot<T>> {
  await prisma.apartmentLocationInsightCache.upsert({
    where: { apartmentId_domain: { apartmentId, domain } },
    create: {
      apartmentId,
      domain,
      status: snapshot.status,
      errorMessage: snapshot.errorMessage,
      fetchedAt: snapshot.fetchedAt,
      payloadJson: snapshot.data != null ? JSON.stringify(snapshot.data) : null,
    },
    update: {
      status: snapshot.status,
      errorMessage: snapshot.errorMessage,
      fetchedAt: snapshot.fetchedAt,
      payloadJson: snapshot.data != null ? JSON.stringify(snapshot.data) : null,
    },
  });
  return snapshot;
}

async function loadAndFetch<T>(
  prisma: PrismaClient,
  apartmentId: string,
  domain: LocationInsightDomain,
  fetcher: Fetcher<T>
): Promise<LocationInsightSnapshot<T>> {
  const apartment = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    select: { latitude: true, longitude: true },
  });

  if (!apartment) {
    return {
      domain,
      status: "error",
      errorMessage: "apartment_not_found",
      fetchedAt: new Date(),
      data: null,
    };
  }

  if (apartment.latitude == null || apartment.longitude == null) {
    const snapshot: LocationInsightSnapshot<T> = {
      domain,
      status: "no_coords",
      errorMessage: null,
      fetchedAt: new Date(),
      data: null,
    };
    return persistSnapshot(prisma, apartmentId, domain, snapshot);
  }

  const fetched = await fetcher(apartment.latitude, apartment.longitude);
  const fetchedAt = new Date();

  if (!fetched.ok) {
    const snapshot: LocationInsightSnapshot<T> = {
      domain,
      status: "error",
      errorMessage: fetched.error,
      fetchedAt,
      data: null,
    };
    return persistSnapshot(prisma, apartmentId, domain, snapshot);
  }

  if (fetched.noData) {
    const snapshot: LocationInsightSnapshot<T> = {
      domain,
      status: "no_data",
      errorMessage: null,
      fetchedAt,
      data: null,
    };
    return persistSnapshot(prisma, apartmentId, domain, snapshot);
  }

  return persistSnapshot(prisma, apartmentId, domain, {
    domain,
    status: "ok",
    errorMessage: null,
    fetchedAt,
    data: fetched.data,
  });
}

function snapshotFromRow<T>(
  domain: LocationInsightDomain,
  row: {
    status: string;
    errorMessage: string | null;
    fetchedAt: Date;
    payloadJson: string | null;
  }
): LocationInsightSnapshot<T> {
  return {
    domain,
    status: row.status as LocationInsightStatus,
    errorMessage: row.errorMessage,
    fetchedAt: row.fetchedAt,
    data: parsePayloadJson<T>(row.payloadJson),
  };
}

export async function getOrFetchLocationInsight<T>(
  prisma: PrismaClient,
  apartmentId: string,
  domain: LocationInsightDomain,
  fetcher: Fetcher<T>
): Promise<LocationInsightSnapshot<T>> {
  const cached = await prisma.apartmentLocationInsightCache.findUnique({
    where: { apartmentId_domain: { apartmentId, domain } },
  });

  if (cached && isFresh(cached.fetchedAt)) {
    return snapshotFromRow<T>(domain, cached);
  }

  return loadAndFetch(prisma, apartmentId, domain, fetcher);
}

export async function refreshLocationInsight<T>(
  prisma: PrismaClient,
  apartmentId: string,
  domain: LocationInsightDomain,
  fetcher: Fetcher<T>
): Promise<LocationInsightSnapshot<T>> {
  return loadAndFetch(prisma, apartmentId, domain, fetcher);
}

export async function getCachedLocationInsight<T>(
  prisma: PrismaClient,
  apartmentId: string,
  domain: LocationInsightDomain
): Promise<LocationInsightSnapshot<T> | null> {
  const cached = await prisma.apartmentLocationInsightCache.findUnique({
    where: { apartmentId_domain: { apartmentId, domain } },
  });
  if (!cached) return null;
  return snapshotFromRow<T>(domain, cached);
}

export async function invalidateLocationInsightsForApartment(
  apartmentId: string
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.apartmentLocationInsightCache.deleteMany({ where: { apartmentId } });
}

export async function invalidateBorisCacheForApartment(apartmentId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.apartmentBorisCache.deleteMany({ where: { apartmentId } });
}

export async function invalidateLocationDataForApartment(apartmentId: string): Promise<void> {
  const { invalidateCommuteCacheForApartment } = await import("@/lib/commute-cache");
  await Promise.all([
    invalidateCommuteCacheForApartment(apartmentId),
    invalidateLocationInsightsForApartment(apartmentId),
    invalidateBorisCacheForApartment(apartmentId),
  ]);
}

export function parseDomainParam(raw: string | null | undefined): LocationInsightDomain | null {
  const trimmed = raw?.trim();
  if (!trimmed || !isLocationInsightDomain(trimmed)) return null;
  return trimmed;
}
