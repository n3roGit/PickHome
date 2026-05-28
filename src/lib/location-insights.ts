import type { PrismaClient } from "@prisma/client";
import { fetchAirQualityUbaForCoords, type AirQualityUbaData } from "@/lib/air-quality-uba";
import { fetchFloodBfgForCoords, type FloodBfgData } from "@/lib/flood-bfg";
import {
  getOrFetchLocationInsight,
  type LocationInsightSnapshot,
} from "@/lib/location-insight-cache";
import type { LocationInsightDomain } from "@/lib/location-insight-types";
import { fetchNoiseUbaForCoords, highestNoiseBandDb, type NoiseUbaData } from "@/lib/noise-uba";
import { fetchOverpassPois, type OverpassPoiData } from "@/lib/overpass-poi";

export type ApartmentLocationInsightsBundle = {
  overpass: LocationInsightSnapshot<OverpassPoiData>;
  noise: LocationInsightSnapshot<NoiseUbaData>;
  flood: LocationInsightSnapshot<FloodBfgData>;
  air: LocationInsightSnapshot<AirQualityUbaData>;
};

export async function fetchLocationInsightForDomain(
  domain: LocationInsightDomain,
  latitude: number,
  longitude: number
): Promise<
  | {
      ok: true;
      data: OverpassPoiData | NoiseUbaData | FloodBfgData | AirQualityUbaData;
      noData?: boolean;
    }
  | { ok: false; error: string }
> {
  switch (domain) {
    case "overpass":
      return fetchOverpassPois(latitude, longitude);
    case "noise":
      return fetchNoiseUbaForCoords(latitude, longitude);
    case "flood":
      return fetchFloodBfgForCoords(latitude, longitude);
    case "air":
      return fetchAirQualityUbaForCoords(latitude, longitude);
    default:
      return { ok: false, error: "unknown_domain" };
  }
}

export async function getOrFetchAllLocationInsights(
  prisma: PrismaClient,
  apartmentId: string
): Promise<ApartmentLocationInsightsBundle> {
  const [overpass, noise, flood, air] = await Promise.all([
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
  ]);
  return { overpass, noise, flood, air };
}

export async function refreshAllLocationInsights(
  prisma: PrismaClient,
  apartmentId: string
): Promise<ApartmentLocationInsightsBundle> {
  const { refreshLocationInsight } = await import("@/lib/location-insight-cache");
  const [overpass, noise, flood, air] = await Promise.all([
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
  ]);
  return { overpass, noise, flood, air };
}

export type LocationInsightWarning = {
  kind: "flood_hq100" | "flood_hqextrem" | "noise_65" | "noise_70" | "air_poor";
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

  return warnings;
}
