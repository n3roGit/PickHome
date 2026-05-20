import { prisma } from "@/lib/prisma";
import type { LocationCity } from "@/lib/location-areas";

export async function fetchLocationCities(): Promise<LocationCity[]> {
  const rows = await prisma.locationCity.findMany({
    orderBy: { name: "asc" },
    include: {
      postalCodes: {
        orderBy: { plz: "asc" },
        include: {
          districts: { orderBy: { name: "asc" } },
        },
      },
    },
  });

  return rows.map((city) => ({
    id: city.id,
    name: city.name,
    postalCodes: city.postalCodes.map((entry) => ({
      plz: entry.plz,
      centroid:
        entry.latitude != null && entry.longitude != null
          ? { lat: entry.latitude, lng: entry.longitude }
          : undefined,
      districts: entry.districts.map((d) => d.name),
    })),
  }));
}

export function parseDistrictNamesInput(raw: string): string[] {
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b, "de"));
}

export function parseGermanPlzInput(raw: string): string | null {
  const plz = raw.replace(/\D/g, "");
  return /^\d{5}$/.test(plz) ? plz : null;
}
