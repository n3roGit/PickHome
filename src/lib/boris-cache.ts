import type { PrismaClient } from "@prisma/client";
import { fetchBorisForCoords, type BorisResult } from "@/lib/boris";

export const BORIS_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type ApartmentBorisStatus = "ok" | "no_coords" | "no_data" | "error";

export type ApartmentBorisSnapshot = {
  status: ApartmentBorisStatus;
  errorMessage: string | null;
  fetchedAt: Date;
  results: BorisResult[];
};

function parseResultsJson(raw: string | null | undefined): BorisResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BorisResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function snapshotFromRow(row: {
  status: string;
  errorMessage: string | null;
  fetchedAt: Date;
  resultsJson: string | null;
}): ApartmentBorisSnapshot {
  return {
    status: row.status as ApartmentBorisStatus,
    errorMessage: row.errorMessage,
    fetchedAt: row.fetchedAt,
    results: parseResultsJson(row.resultsJson),
  };
}

function isFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < BORIS_CACHE_TTL_MS;
}

async function persistSnapshot(
  prisma: PrismaClient,
  apartmentId: string,
  snapshot: ApartmentBorisSnapshot
): Promise<ApartmentBorisSnapshot> {
  const row = await prisma.apartmentBorisCache.upsert({
    where: { apartmentId },
    create: {
      apartmentId,
      status: snapshot.status,
      errorMessage: snapshot.errorMessage,
      fetchedAt: snapshot.fetchedAt,
      resultsJson: snapshot.results.length > 0 ? JSON.stringify(snapshot.results) : null,
    },
    update: {
      status: snapshot.status,
      errorMessage: snapshot.errorMessage,
      fetchedAt: snapshot.fetchedAt,
      resultsJson: snapshot.results.length > 0 ? JSON.stringify(snapshot.results) : null,
    },
  });

  return snapshotFromRow(row);
}

async function loadAndFetch(
  prisma: PrismaClient,
  apartmentId: string
): Promise<ApartmentBorisSnapshot> {
  const apartment = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    select: { latitude: true, longitude: true },
  });

  if (!apartment) {
    return {
      status: "error",
      errorMessage: "apartment_not_found",
      fetchedAt: new Date(),
      results: [],
    };
  }

  if (apartment.latitude == null || apartment.longitude == null) {
    return persistSnapshot(prisma, apartmentId, {
      status: "no_coords",
      errorMessage: null,
      fetchedAt: new Date(),
      results: [],
    });
  }

  const fetched = await fetchBorisForCoords(apartment.latitude, apartment.longitude);
  const fetchedAt = new Date();

  if (!fetched.ok) {
    return persistSnapshot(prisma, apartmentId, {
      status: "error",
      errorMessage: fetched.error,
      fetchedAt,
      results: [],
    });
  }

  if (fetched.results.length === 0) {
    return persistSnapshot(prisma, apartmentId, {
      status: "no_data",
      errorMessage: null,
      fetchedAt,
      results: [],
    });
  }

  return persistSnapshot(prisma, apartmentId, {
    status: "ok",
    errorMessage: null,
    fetchedAt,
    results: fetched.results,
  });
}

export async function getOrFetchBorisForApartment(
  prisma: PrismaClient,
  apartmentId: string
): Promise<ApartmentBorisSnapshot> {
  const cached = await prisma.apartmentBorisCache.findUnique({
    where: { apartmentId },
  });

  if (cached && isFresh(cached.fetchedAt)) {
    return snapshotFromRow(cached);
  }

  return loadAndFetch(prisma, apartmentId);
}

export async function refreshBorisForApartment(
  prisma: PrismaClient,
  apartmentId: string
): Promise<ApartmentBorisSnapshot> {
  return loadAndFetch(prisma, apartmentId);
}
