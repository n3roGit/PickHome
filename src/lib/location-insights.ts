import type { PrismaClient } from "@prisma/client";
import { fetchAirQualityUbaForCoords, type AirQualityUbaData } from "@/lib/air-quality-uba";
import {
  fetchClimateNormalsForCoords,
  type ClimateNormalsData,
} from "@/lib/climate-open-meteo";
import { fetchFloodBfgForCoords, type FloodBfgData } from "@/lib/flood-bfg";
import {
  getCachedLocationInsight,
  getOrFetchLocationInsight,
  isLocationInsightCacheFresh,
  type LocationInsightSnapshot,
} from "@/lib/location-insight-cache";
import {
  LOCATION_INSIGHT_DOMAINS,
  type LocationInsightDomain,
} from "@/lib/location-insight-types";
import { fetchNoiseUbaForCoords, highestNoiseBandDb, type NoiseUbaData } from "@/lib/noise-uba";
import { fetchOverpassMicro, type OverpassMicroData } from "@/lib/overpass-micro";
import { fetchOverpassPois, type OverpassPoiData } from "@/lib/overpass-poi";
import { fetchRadonBfsForCoords, type RadonBfsData } from "@/lib/radon-bfs";

export type ApartmentLocationInsightsBundle = {
  overpass: LocationInsightSnapshot<OverpassPoiData>;
  noise: LocationInsightSnapshot<NoiseUbaData>;
  flood: LocationInsightSnapshot<FloodBfgData>;
  air: LocationInsightSnapshot<AirQualityUbaData>;
  radon: LocationInsightSnapshot<RadonBfsData>;
  micro: LocationInsightSnapshot<OverpassMicroData>;
  climate: LocationInsightSnapshot<ClimateNormalsData>;
};

export type LocationInsightFetchOptions = {
  background?: boolean;
};

function pendingSnapshot<T>(domain: LocationInsightDomain): LocationInsightSnapshot<T> {
  return {
    domain,
    status: "pending",
    errorMessage: null,
    fetchedAt: new Date(0),
    data: null,
  };
}

function noCoordsSnapshot<T>(domain: LocationInsightDomain): LocationInsightSnapshot<T> {
  return {
    domain,
    status: "no_coords",
    errorMessage: null,
    fetchedAt: new Date(),
    data: null,
  };
}

function errorSnapshot<T>(
  domain: LocationInsightDomain,
  errorMessage: string
): LocationInsightSnapshot<T> {
  return {
    domain,
    status: "error",
    errorMessage,
    fetchedAt: new Date(),
    data: null,
  };
}

export function needsLocationInsightBackfill(bundle: ApartmentLocationInsightsBundle): boolean {
  for (const domain of LOCATION_INSIGHT_DOMAINS) {
    const snapshot = bundle[domain];
    if (snapshot.status === "pending") return true;
    if (snapshot.status === "no_coords") continue;
    if (!isLocationInsightCacheFresh(snapshot.fetchedAt)) return true;
  }
  return false;
}

/** Cached snapshots only — never blocks on external APIs (use for SSR). */
export async function getCachedAllLocationInsights(
  prisma: PrismaClient,
  apartmentId: string
): Promise<ApartmentLocationInsightsBundle> {
  const apartment = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    select: { latitude: true, longitude: true },
  });

  if (!apartment) {
    return {
      overpass: errorSnapshot<OverpassPoiData>("overpass", "apartment_not_found"),
      noise: errorSnapshot<NoiseUbaData>("noise", "apartment_not_found"),
      flood: errorSnapshot<FloodBfgData>("flood", "apartment_not_found"),
      air: errorSnapshot<AirQualityUbaData>("air", "apartment_not_found"),
      radon: errorSnapshot<RadonBfsData>("radon", "apartment_not_found"),
      micro: errorSnapshot<OverpassMicroData>("micro", "apartment_not_found"),
      climate: errorSnapshot<ClimateNormalsData>("climate", "apartment_not_found"),
    };
  }

  if (apartment.latitude == null || apartment.longitude == null) {
    return {
      overpass: noCoordsSnapshot<OverpassPoiData>("overpass"),
      noise: noCoordsSnapshot<NoiseUbaData>("noise"),
      flood: noCoordsSnapshot<FloodBfgData>("flood"),
      air: noCoordsSnapshot<AirQualityUbaData>("air"),
      radon: noCoordsSnapshot<RadonBfsData>("radon"),
      micro: noCoordsSnapshot<OverpassMicroData>("micro"),
      climate: noCoordsSnapshot<ClimateNormalsData>("climate"),
    };
  }

  const [overpass, noise, flood, air, radon, micro, climate] = await Promise.all([
    getCachedLocationInsight<OverpassPoiData>(prisma, apartmentId, "overpass"),
    getCachedLocationInsight<NoiseUbaData>(prisma, apartmentId, "noise"),
    getCachedLocationInsight<FloodBfgData>(prisma, apartmentId, "flood"),
    getCachedLocationInsight<AirQualityUbaData>(prisma, apartmentId, "air"),
    getCachedLocationInsight<RadonBfsData>(prisma, apartmentId, "radon"),
    getCachedLocationInsight<OverpassMicroData>(prisma, apartmentId, "micro"),
    getCachedLocationInsight<ClimateNormalsData>(prisma, apartmentId, "climate"),
  ]);

  return {
    overpass: overpass ?? pendingSnapshot<OverpassPoiData>("overpass"),
    noise: noise ?? pendingSnapshot<NoiseUbaData>("noise"),
    flood: flood ?? pendingSnapshot<FloodBfgData>("flood"),
    air: air ?? pendingSnapshot<AirQualityUbaData>("air"),
    radon: radon ?? pendingSnapshot<RadonBfsData>("radon"),
    micro: micro ?? pendingSnapshot<OverpassMicroData>("micro"),
    climate: climate ?? pendingSnapshot<ClimateNormalsData>("climate"),
  };
}

export async function fetchLocationInsightForDomain(
  domain: LocationInsightDomain,
  latitude: number,
  longitude: number,
  options?: LocationInsightFetchOptions
): Promise<
  | {
      ok: true;
      data:
        | OverpassPoiData
        | NoiseUbaData
        | FloodBfgData
        | AirQualityUbaData
        | RadonBfsData
        | OverpassMicroData
        | ClimateNormalsData;
      noData?: boolean;
    }
  | { ok: false; error: string }
> {
  switch (domain) {
    case "overpass":
      return fetchOverpassPois(latitude, longitude, options);
    case "noise":
      return fetchNoiseUbaForCoords(latitude, longitude, options);
    case "flood":
      return fetchFloodBfgForCoords(latitude, longitude, options);
    case "air":
      return fetchAirQualityUbaForCoords(latitude, longitude, options);
    case "radon":
      return fetchRadonBfsForCoords(latitude, longitude, options);
    case "micro":
      return fetchOverpassMicro(latitude, longitude, options);
    case "climate":
      return fetchClimateNormalsForCoords(latitude, longitude, options);
    default:
      return { ok: false, error: "unknown_domain" };
  }
}

export async function getOrFetchAllLocationInsights(
  prisma: PrismaClient,
  apartmentId: string
): Promise<ApartmentLocationInsightsBundle> {
  const [overpass, noise, flood, air, radon, micro, climate] = await Promise.all([
    getOrFetchLocationInsight(prisma, apartmentId, "overpass", (lat, lng) =>
      fetchOverpassPois(lat, lng)
    ),
    getOrFetchLocationInsight(prisma, apartmentId, "noise", (lat, lng) =>
      fetchNoiseUbaForCoords(lat, lng)
    ),
    getOrFetchLocationInsight(prisma, apartmentId, "flood", (lat, lng) =>
      fetchFloodBfgForCoords(lat, lng)
    ),
    getOrFetchLocationInsight(prisma, apartmentId, "air", (lat, lng) =>
      fetchAirQualityUbaForCoords(lat, lng)
    ),
    getOrFetchLocationInsight(prisma, apartmentId, "radon", (lat, lng) =>
      fetchRadonBfsForCoords(lat, lng)
    ),
    getOrFetchLocationInsight(prisma, apartmentId, "micro", (lat, lng) =>
      fetchOverpassMicro(lat, lng)
    ),
    getOrFetchLocationInsight(prisma, apartmentId, "climate", (lat, lng) =>
      fetchClimateNormalsForCoords(lat, lng)
    ),
  ]);
  return { overpass, noise, flood, air, radon, micro, climate };
}

export async function refreshAllLocationInsights(
  prisma: PrismaClient,
  apartmentId: string
): Promise<ApartmentLocationInsightsBundle> {
  const { refreshLocationInsight } = await import("@/lib/location-insight-cache");
  const [overpass, noise, flood, air, radon, micro, climate] = await Promise.all([
    refreshLocationInsight(prisma, apartmentId, "overpass", (lat, lng) =>
      fetchOverpassPois(lat, lng)
    ),
    refreshLocationInsight(prisma, apartmentId, "noise", (lat, lng) =>
      fetchNoiseUbaForCoords(lat, lng)
    ),
    refreshLocationInsight(prisma, apartmentId, "flood", (lat, lng) =>
      fetchFloodBfgForCoords(lat, lng)
    ),
    refreshLocationInsight(prisma, apartmentId, "air", (lat, lng) =>
      fetchAirQualityUbaForCoords(lat, lng)
    ),
    refreshLocationInsight(prisma, apartmentId, "radon", (lat, lng) =>
      fetchRadonBfsForCoords(lat, lng)
    ),
    refreshLocationInsight(prisma, apartmentId, "micro", (lat, lng) =>
      fetchOverpassMicro(lat, lng)
    ),
    refreshLocationInsight(prisma, apartmentId, "climate", (lat, lng) =>
      fetchClimateNormalsForCoords(lat, lng)
    ),
  ]);
  return { overpass, noise, flood, air, radon, micro, climate };
}

export type LocationInsightWarning = {
  kind:
    | "flood_hq100"
    | "flood_hqextrem"
    | "noise_65"
    | "noise_70"
    | "air_poor"
    | "radon_elevated"
    | "radon_precaution";
  label: string;
};

export function locationInsightWarnings(
  bundle: ApartmentLocationInsightsBundle
): LocationInsightWarning[] {
  const warnings: LocationInsightWarning[] = [];

  if (bundle.flood.status === "ok" && bundle.flood.data) {
    if (bundle.flood.data.scenarios.HQ100 === "betroffen") {
      warnings.push({ kind: "flood_hq100", label: "Hochwasser HQ100" });
    } else if (bundle.flood.data.scenarios.HQextrem === "betroffen") {
      warnings.push({ kind: "flood_hqextrem", label: "Hochwasser extrem" });
    }
  }

  if (bundle.noise.status === "ok" && bundle.noise.data?.hits.length) {
    const max = highestNoiseBandDb(bundle.noise.data.hits);
    if (max != null && max >= 70) {
      warnings.push({ kind: "noise_70", label: `Lärm ≥ ${max} dB` });
    } else if (max != null && max >= 65) {
      warnings.push({ kind: "noise_65", label: `Lärm ≥ ${max} dB` });
    }
  }

  if (bundle.air.status === "ok" && bundle.air.data?.measurements.length) {
    const worst = Math.max(...bundle.air.data.measurements.map((m) => m.value));
    if (worst >= 4) {
      warnings.push({ kind: "air_poor", label: "Luftqualität belastet" });
    }
  }

  if (bundle.radon.status === "ok" && bundle.radon.data) {
    if (bundle.radon.data.precautionAreas.length > 0) {
      warnings.push({ kind: "radon_precaution", label: "Radon-Vorsorgegebiet" });
    } else if (
      bundle.radon.data.indoorRadonBqPerM3 != null &&
      bundle.radon.data.indoorRadonBqPerM3 >= 100
    ) {
      warnings.push({
        kind: "radon_elevated",
        label: `Radon Ø ${bundle.radon.data.indoorRadonBqPerM3} Bq/m³`,
      });
    }
  }

  return warnings;
}
