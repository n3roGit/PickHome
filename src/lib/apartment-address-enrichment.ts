import { revalidatePath } from "next/cache";
import {
  backgroundThrottlePause,
  beginBackgroundTask,
  endBackgroundTask,
} from "@/lib/background-task";
import { invalidateCommuteCacheForApartment } from "@/lib/commute-cache";
import type { GeocodeResult } from "@/lib/geocode";
import {
  applyGeocodeToStoredAddress,
  enrichAddressWithDistrict,
  geocodeAddress,
  reverseGeocodeAddress,
} from "@/lib/geocode";
import { isExternalServiceInCooldown } from "@/lib/external-fetch";
import { prisma } from "@/lib/prisma";

export const ADDRESS_ENRICHMENT_MAX_PER_TICK = 3;

export type ApartmentAddressRow = {
  id: string;
  projectId: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type EnrichApartmentAddressResult = {
  updated: boolean;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordsChanged?: boolean;
};

/** Forward geocode, then reverse when district or coordinates are still missing. */
export async function resolveApartmentGeocode(
  address: string,
  existing?: { latitude: number | null; longitude: number | null }
): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  let result = await geocodeAddress(trimmed);

  const hasCoords = existing?.latitude != null && existing?.longitude != null;
  if (hasCoords && !result?.district) {
    const reverse = await reverseGeocodeAddress(existing!.latitude!, existing!.longitude!);
    if (reverse) {
      result = result
        ? {
            ...result,
            district: reverse.district,
            displayName: result.displayName ?? reverse.displayName,
          }
        : reverse;
    }
  }

  if (!result && hasCoords) {
    result = await reverseGeocodeAddress(existing!.latitude!, existing!.longitude!);
  }

  return result;
}

export async function enrichApartmentAddressInBackground(apartmentId: string): Promise<void> {
  beginBackgroundTask();
  try {
    const apt = await prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: {
        id: true,
        projectId: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!apt?.address?.trim()) return;

    const result = await enrichApartmentAddressRecord(apt);
    if (!result.updated) return;

    await prisma.apartment.update({
      where: { id: apartmentId },
      data: {
        address: result.address,
        latitude: result.latitude ?? undefined,
        longitude: result.longitude ?? undefined,
      },
    });
    if (result.coordsChanged) {
      await invalidateCommuteCacheForApartment(apartmentId);
    }

    revalidatePath(`/project/${apt.projectId}/apartment/${apartmentId}`);
    if (result.coordsChanged) {
      revalidatePath(`/project/${apt.projectId}`);
    }
  } catch (error) {
    console.error("[pickhome] Background apartment address enrichment failed:", error);
  } finally {
    endBackgroundTask();
  }
}

/** Geocode one apartment after create/update without blocking the HTTP response. */
export function scheduleApartmentAddressEnrichment(apartmentId: string): void {
  if (process.env.PICKHOME_ADDRESS_ENRICHMENT === "0") return;
  void enrichApartmentAddressInBackground(apartmentId);
}

export async function enrichApartmentAddressRecord(
  apt: ApartmentAddressRow
): Promise<EnrichApartmentAddressResult> {
  const raw = apt.address?.trim();
  if (!raw) return { updated: false };

  const geocoded = await resolveApartmentGeocode(raw, {
    latitude: apt.latitude,
    longitude: apt.longitude,
  });
  const applied = applyGeocodeToStoredAddress(raw, geocoded);
  const enriched = applied.address;
  const coordsChanged =
    applied.latitude != null &&
    applied.longitude != null &&
    (apt.latitude == null ||
      apt.longitude == null ||
      apt.latitude !== applied.latitude ||
      apt.longitude !== applied.longitude);
  const addressChanged = enriched !== raw;

  if (!addressChanged && !coordsChanged) {
    return { updated: false };
  }

  return {
    updated: true,
    address: enriched,
    latitude: applied.latitude,
    longitude: applied.longitude,
    coordsChanged,
  };
}

export function addressWouldChangeAfterEnrichment(
  rawAddress: string,
  geocode: GeocodeResult | null
): boolean {
  const trimmed = rawAddress.trim();
  if (!trimmed || !geocode?.district) return false;
  return enrichAddressWithDistrict(trimmed, geocode.district) !== trimmed;
}

export type AddressEnrichmentBackfillTickResult = {
  attempted: number;
  updated: number;
  stoppedEarly: boolean;
};

export type ReindexProjectAddressesResult = {
  processed: number;
  updated: number;
  skipped: number;
};

export async function reindexProjectAddresses(
  projectId: string
): Promise<ReindexProjectAddressesResult> {
  const apartments = await prisma.apartment.findMany({
    where: { projectId, archivedAt: null, address: { not: "" } },
    select: {
      id: true,
      projectId: true,
      address: true,
      latitude: true,
      longitude: true,
    },
    orderBy: [{ latitude: "asc" }, { createdAt: "asc" }],
  });

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const apt of apartments) {
    if (isExternalServiceInCooldown("nominatim")) break;
    processed++;
    const result = await enrichApartmentAddressRecord(apt);
    if (!result.updated) {
      skipped++;
      await backgroundThrottlePause(200);
      continue;
    }
    await prisma.apartment.update({
      where: { id: apt.id },
      data: {
        address: result.address,
        latitude: result.latitude ?? undefined,
        longitude: result.longitude ?? undefined,
      },
    });
    if (result.coordsChanged) {
      await invalidateCommuteCacheForApartment(apt.id);
    }
    updated++;
    await backgroundThrottlePause(1100);
  }

  return { processed, updated, skipped };
}

export async function runAddressEnrichmentBackfillTick(
  maxPerTick = ADDRESS_ENRICHMENT_MAX_PER_TICK
): Promise<AddressEnrichmentBackfillTickResult> {
  if (process.env.PICKHOME_ADDRESS_ENRICHMENT === "0") {
    return { attempted: 0, updated: 0, stoppedEarly: false };
  }
  if (isExternalServiceInCooldown("nominatim")) {
    return { attempted: 0, updated: 0, stoppedEarly: true };
  }

  const candidates = await prisma.apartment.findMany({
    where: { archivedAt: null, address: { not: "" } },
    select: {
      id: true,
      projectId: true,
      address: true,
      latitude: true,
      longitude: true,
    },
    orderBy: [{ latitude: "asc" }, { createdAt: "asc" }],
    take: Math.max(maxPerTick * 15, maxPerTick),
  });

  let attempted = 0;
  let updated = 0;
  let stoppedEarly = false;

  for (const apt of candidates) {
    if (updated >= maxPerTick) break;
    if (isExternalServiceInCooldown("nominatim")) {
      stoppedEarly = true;
      break;
    }

    attempted++;
    const result = await enrichApartmentAddressRecord(apt);
    if (!result.updated) {
      await backgroundThrottlePause(150);
      continue;
    }

    await prisma.apartment.update({
      where: { id: apt.id },
      data: {
        address: result.address,
        latitude: result.latitude ?? undefined,
        longitude: result.longitude ?? undefined,
      },
    });
    if (result.coordsChanged) {
      await invalidateCommuteCacheForApartment(apt.id);
    }
    updated++;
    await backgroundThrottlePause(1100);
  }

  return { attempted, updated, stoppedEarly };
}
