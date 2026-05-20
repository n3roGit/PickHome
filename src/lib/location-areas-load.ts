import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getPickHomeDataDir } from "@/lib/pickhome-data";
import { parseLocationCityFile, type LocationCity } from "@/lib/location-areas";

let cachedCatalog: LocationCity[] | null = null;
let cachedDirMtimeMs = 0;

function locationAreasDir() {
  return join(getPickHomeDataDir(), "location-areas");
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
