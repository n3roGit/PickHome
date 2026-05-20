import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getPickHomeDataDir } from "@/lib/pickhome-data";

export type LocationCentroid = {
  lat: number;
  lng: number;
};

export type LocationPostalCode = {
  plz: string;
  centroid?: LocationCentroid;
  districts: string[];
};

export type LocationCity = {
  id: string;
  name: string;
  postalCodes: LocationPostalCode[];
};

let cachedCatalog: LocationCity[] | null = null;
let cachedDirMtimeMs = 0;

function locationAreasDir() {
  return join(getPickHomeDataDir(), "location-areas");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function parseCentroid(raw: unknown): LocationCentroid | undefined {
  if (!isRecord(raw)) return undefined;
  const lat = raw.lat;
  const lng = raw.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

export function parseLocationCityFile(raw: string, sourceLabel: string): LocationCity | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  const id = String(data.id ?? "").trim();
  const name = String(data.name ?? "").trim();
  if (!id || !name) return null;

  if (!Array.isArray(data.postalCodes)) return null;

  const postalCodes: LocationPostalCode[] = [];
  for (const entry of data.postalCodes) {
    if (!isRecord(entry)) continue;
    const plz = String(entry.plz ?? "").trim();
    if (!/^\d{5}$/.test(plz)) continue;
    if (!Array.isArray(entry.districts)) continue;
    const districts = [...new Set(entry.districts.map((d) => String(d).trim()).filter(Boolean))];
    if (districts.length === 0) continue;
    postalCodes.push({
      plz,
      centroid: parseCentroid(entry.centroid),
      districts: districts.sort((a, b) => a.localeCompare(b, "de")),
    });
  }

  if (postalCodes.length === 0) {
    console.warn(`[pickhome] location area "${sourceLabel}" has no valid postal codes`);
    return null;
  }

  postalCodes.sort((a, b) => a.plz.localeCompare(b.plz));

  return { id, name, postalCodes };
}

function readCatalogFromDisk(): LocationCity[] {
  const dir = locationAreasDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
  const cities: LocationCity[] = [];

  for (const fileName of files) {
    const filePath = join(dir, fileName);
    try {
      const raw = readFileSync(filePath, "utf-8");
      const city = parseLocationCityFile(raw, fileName);
      if (city) cities.push(city);
    } catch (error) {
      console.warn(`[pickhome] failed to read location area ${fileName}:`, error);
    }
  }

  return cities.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function dirMtimeMs(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return statSync(dir).mtimeMs;
  } catch {
    return 0;
  }
}

export function clearLocationAreasCache() {
  cachedCatalog = null;
  cachedDirMtimeMs = 0;
}

/** Loads city catalogs from PICKHOME_DATA_DIR/location-areas/*.json */
export function loadLocationCities(): LocationCity[] {
  const dir = locationAreasDir();
  const mtime = dirMtimeMs(dir);
  if (cachedCatalog != null && mtime === cachedDirMtimeMs) {
    return cachedCatalog;
  }
  cachedCatalog = readCatalogFromDisk();
  cachedDirMtimeMs = mtime;
  return cachedCatalog;
}

export function listLocationCities(
  catalog: LocationCity[]
): Pick<LocationCity, "id" | "name">[] {
  return catalog.map(({ id, name }) => ({ id, name }));
}

export function getLocationCity(
  catalog: LocationCity[],
  cityId: string | null | undefined
): LocationCity | null {
  if (!cityId) return null;
  return catalog.find((c) => c.id === cityId) ?? null;
}

export function getPostalCodeEntry(
  city: LocationCity,
  plz: string
): LocationPostalCode | null {
  return city.postalCodes.find((p) => p.plz === plz) ?? null;
}

export function districtsForPlzList(city: LocationCity, plzList: string[]): string[] {
  const set = new Set<string>();
  for (const plz of plzList) {
    const entry = city.postalCodes.find((p) => p.plz === plz);
    if (entry) {
      for (const district of entry.districts) {
        set.add(district);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}

export function allDistrictsForPlz(city: LocationCity, plz: string): string[] {
  return getPostalCodeEntry(city, plz)?.districts ?? [];
}

export function selectedPlzCentroids(
  city: LocationCity,
  selectedPlz: string[]
): Array<{ plz: string; lat: number; lng: number }> {
  return selectedPlz
    .map((plz) => {
      const entry = city.postalCodes.find((p) => p.plz === plz);
      if (!entry?.centroid) return null;
      return { plz, lat: entry.centroid.lat, lng: entry.centroid.lng };
    })
    .filter((c): c is { plz: string; lat: number; lng: number } => c != null);
}
