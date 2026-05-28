import { fetchExternal, type FetchExternalOptions } from "@/lib/external-fetch";
import { distanceMeters } from "@/lib/geo-coords";
import { OVERPASS_API_URL } from "@/lib/overpass-poi";

export const MICRO_BUILDING_RADIUS_M = 50;
export const MICRO_INDUSTRIAL_RADIUS_M = 500;
export const MICRO_ROAD_RADIUS_M = 300;
export const MICRO_RAIL_RADIUS_M = 400;
export const MICRO_NIGHTLIFE_RADIUS_M = 300;

export type MicroMapCategoryId =
  | "industrial"
  | "majorRoad"
  | "railway"
  | "nightlife";

export type MicroLocationItem = {
  name: string | null;
  distanceM: number;
  detail: string | null;
  osmType: string;
  osmId: number;
  lat: number;
  lng: number;
};

export type MicroCategorySummary = {
  count: number;
  nearest: MicroLocationItem | null;
};

export type OverpassMicroData = {
  building: MicroLocationItem | null;
  industrial: MicroCategorySummary;
  majorRoad: MicroCategorySummary;
  railway: MicroCategorySummary;
  nightlife: MicroCategorySummary;
  buildingHeadline: string;
  industrialHeadline: string;
  transportHeadline: string;
  nightlifeHeadline: string;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function elementCoords(el: OverpassElement): { lat: number; lng: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

export function buildOverpassMicroQueryParts(latitude: number, longitude: number): string {
  const lat = latitude;
  const lon = longitude;
  return `way["building"](around:${MICRO_BUILDING_RADIUS_M},${lat},${lon});
nwr["landuse"~"industrial|brownfield|commercial"](around:${MICRO_INDUSTRIAL_RADIUS_M},${lat},${lon});
way["highway"~"motorway|trunk|primary"](around:${MICRO_ROAD_RADIUS_M},${lat},${lon});
way["railway"~"rail|tram|subway|light_rail"](around:${MICRO_RAIL_RADIUS_M},${lat},${lon});
nwr["amenity"~"bar|pub|nightclub|biergarten"](around:${MICRO_NIGHTLIFE_RADIUS_M},${lat},${lon});`;
}

function buildOverpassMicroQuery(latitude: number, longitude: number): string {
  return `[out:json][timeout:25];(${buildOverpassMicroQueryParts(latitude, longitude)});out center tags;`;
}

function formatBuildingDetail(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  if (tags.building && tags.building !== "yes") parts.push(tags.building);
  if (tags["building:levels"]) parts.push(`${tags["building:levels"]} Etagen`);
  if (tags.start_date) parts.push(`Baujahr ${tags.start_date}`);
  if (tags.heritage) {
    const criteria = tags["lda:criteria"] ?? tags.heritage;
    parts.push(`Denkmal (${criteria})`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatRoadDetail(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  if (tags.name) parts.push(tags.name);
  if (tags.ref) parts.push(tags.ref);
  if (tags.maxspeed) parts.push(`${tags.maxspeed} km/h`);
  if (tags.highway) parts.push(tags.highway);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatRailDetail(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  if (tags.name) parts.push(tags.name);
  if (tags.railway) parts.push(tags.railway);
  if (tags.usage) parts.push(tags.usage);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatNightlifeDetail(tags: Record<string, string>): string | null {
  if (tags.amenity) return tags.amenity;
  return null;
}

function summarizeCategory(
  elements: OverpassElement[],
  originLat: number,
  originLng: number,
  radiusM: number,
  matches: (el: OverpassElement) => boolean,
  detailFn: (tags: Record<string, string>) => string | null
): MicroCategorySummary {
  let count = 0;
  let nearest: MicroLocationItem | null = null;

  for (const el of elements) {
    if (!matches(el)) continue;
    const coords = elementCoords(el);
    if (!coords) continue;
    const distanceM = Math.round(distanceMeters(originLat, originLng, coords.lat, coords.lng));
    if (distanceM > radiusM) continue;
    count += 1;
    const tags = el.tags ?? {};
    const item: MicroLocationItem = {
      name: tags.name?.trim() || null,
      distanceM,
      detail: detailFn(tags),
      osmType: el.type,
      osmId: el.id,
      lat: coords.lat,
      lng: coords.lng,
    };
    if (!nearest || distanceM < nearest.distanceM) nearest = item;
  }

  return { count, nearest };
}

function nearestLabel(item: MicroLocationItem | null, fallback: string): string {
  if (!item) return fallback;
  const name = item.name ?? fallback;
  return `${name} (${item.distanceM} m)`;
}

export function parseOverpassMicroElements(
  elements: OverpassElement[],
  latitude: number,
  longitude: number
): OverpassMicroData {
  let building: MicroLocationItem | null = null;
  for (const el of elements) {
    if (!el.tags?.building) continue;
    const coords = elementCoords(el);
    if (!coords) continue;
    const distanceM = Math.round(distanceMeters(latitude, longitude, coords.lat, coords.lng));
    if (distanceM > MICRO_BUILDING_RADIUS_M) continue;
    const tags = el.tags ?? {};
    const item: MicroLocationItem = {
      name: tags.name?.trim() || null,
      distanceM,
      detail: formatBuildingDetail(tags),
      osmType: el.type,
      osmId: el.id,
      lat: coords.lat,
      lng: coords.lng,
    };
    if (!building || distanceM < building.distanceM) building = item;
  }

  const industrial = summarizeCategory(
    elements,
    latitude,
    longitude,
    MICRO_INDUSTRIAL_RADIUS_M,
    (el) => {
      const lu = el.tags?.landuse;
      return lu === "industrial" || lu === "brownfield" || lu === "commercial";
    },
    (tags) => tags.landuse ?? null
  );

  const majorRoad = summarizeCategory(
    elements,
    latitude,
    longitude,
    MICRO_ROAD_RADIUS_M,
    (el) => {
      const h = el.tags?.highway;
      return h === "motorway" || h === "trunk" || h === "primary";
    },
    formatRoadDetail
  );

  const railway = summarizeCategory(
    elements,
    latitude,
    longitude,
    MICRO_RAIL_RADIUS_M,
    (el) => {
      const r = el.tags?.railway;
      return r === "rail" || r === "tram" || r === "subway" || r === "light_rail";
    },
    formatRailDetail
  );

  const nightlife = summarizeCategory(
    elements,
    latitude,
    longitude,
    MICRO_NIGHTLIFE_RADIUS_M,
    (el) => {
      const a = el.tags?.amenity;
      return a === "bar" || a === "pub" || a === "nightclub" || a === "biergarten";
    },
    formatNightlifeDetail
  );

  const buildingHeadline = building
    ? building.detail ?? `Gebäude ${building.distanceM} m entfernt`
    : "Kein Gebäude in unmittelbarer Nähe kartiert";

  const industrialHeadline =
    industrial.count > 0
      ? `${industrial.count} Gewerbe/Industrie im Umkreis ${MICRO_INDUSTRIAL_RADIUS_M} m · nächste: ${nearestLabel(industrial.nearest, "Fläche")}`
      : `Keine Gewerbe-/Industriefläche im Umkreis ${MICRO_INDUSTRIAL_RADIUS_M} m`;

  const transportParts: string[] = [];
  if (majorRoad.count > 0) {
    transportParts.push(
      `Straße: ${nearestLabel(majorRoad.nearest, "Hauptstraße")} (${majorRoad.count} im Umkreis ${MICRO_ROAD_RADIUS_M} m)`
    );
  }
  if (railway.count > 0) {
    transportParts.push(
      `Schiene: ${nearestLabel(railway.nearest, "Trasse")} (${railway.count} im Umkreis ${MICRO_RAIL_RADIUS_M} m)`
    );
  }
  const transportHeadline =
    transportParts.length > 0
      ? transportParts.join(" · ")
      : `Keine Hauptstraße oder Schienentrasse in ${MICRO_ROAD_RADIUS_M}/${MICRO_RAIL_RADIUS_M} m`;

  const nightlifeHeadline =
    nightlife.count > 0
      ? `${nightlife.count} Bar/Club im Umkreis ${MICRO_NIGHTLIFE_RADIUS_M} m · nächste: ${nearestLabel(nightlife.nearest, "Gastronomie")}`
      : `Keine Bars/Clubs im Umkreis ${MICRO_NIGHTLIFE_RADIUS_M} m`;

  return {
    building,
    industrial,
    majorRoad,
    railway,
    nightlife,
    buildingHeadline,
    industrialHeadline,
    transportHeadline,
    nightlifeHeadline,
  };
}

export type MicroMapMarker = {
  categoryId: MicroMapCategoryId;
  name: string | null;
  distanceM: number;
  lat: number;
  lng: number;
  osmType: string;
  osmId: number;
  detail: string | null;
};

function pushMicroMarker(
  markers: MicroMapMarker[],
  seen: Set<string>,
  categoryId: MicroMapCategoryId,
  item: MicroLocationItem,
  fallbackName: string
): void {
  const key = `${categoryId}:${item.osmType}:${item.osmId}`;
  if (seen.has(key)) return;
  seen.add(key);
  markers.push({
    categoryId,
    name: item.name ?? fallbackName,
    distanceM: item.distanceM,
    lat: item.lat,
    lng: item.lng,
    osmType: item.osmType,
    osmId: item.osmId,
    detail: item.detail,
  });
}

export function collectMicroMapMarkers(
  elements: OverpassElement[],
  latitude: number,
  longitude: number
): MicroMapMarker[] {
  const markers: MicroMapMarker[] = [];
  const seen = new Set<string>();

  for (const el of elements) {
    const coords = elementCoords(el);
    if (!coords) continue;
    const tags = el.tags ?? {};
    const distanceM = Math.round(distanceMeters(latitude, longitude, coords.lat, coords.lng));
    const lu = tags.landuse;
    if (
      lu === "industrial" ||
      lu === "brownfield" ||
      lu === "commercial"
    ) {
      if (distanceM <= MICRO_INDUSTRIAL_RADIUS_M) {
        pushMicroMarker(
          markers,
          seen,
          "industrial",
          {
            name: tags.name?.trim() || null,
            distanceM,
            detail: lu,
            osmType: el.type,
            osmId: el.id,
            lat: coords.lat,
            lng: coords.lng,
          },
          "Gewerbe/Industrie"
        );
      }
    }
    const h = tags.highway;
    if (h === "motorway" || h === "trunk" || h === "primary") {
      if (distanceM <= MICRO_ROAD_RADIUS_M) {
        pushMicroMarker(
          markers,
          seen,
          "majorRoad",
          {
            name: tags.name?.trim() || null,
            distanceM,
            detail: formatRoadDetail(tags),
            osmType: el.type,
            osmId: el.id,
            lat: coords.lat,
            lng: coords.lng,
          },
          "Hauptstraße"
        );
      }
    }
    const r = tags.railway;
    if (r === "rail" || r === "tram" || r === "subway" || r === "light_rail") {
      if (distanceM <= MICRO_RAIL_RADIUS_M) {
        pushMicroMarker(
          markers,
          seen,
          "railway",
          {
            name: tags.name?.trim() || null,
            distanceM,
            detail: formatRailDetail(tags),
            osmType: el.type,
            osmId: el.id,
            lat: coords.lat,
            lng: coords.lng,
          },
          "Schiene"
        );
      }
    }
    const a = tags.amenity;
    if (a === "bar" || a === "pub" || a === "nightclub" || a === "biergarten") {
      if (distanceM <= MICRO_NIGHTLIFE_RADIUS_M) {
        pushMicroMarker(
          markers,
          seen,
          "nightlife",
          {
            name: tags.name?.trim() || null,
            distanceM,
            detail: formatNightlifeDetail(tags),
            osmType: el.type,
            osmId: el.id,
            lat: coords.lat,
            lng: coords.lng,
          },
          "Bar/Club"
        );
      }
    }
  }

  return markers;
}

export function formatMicroLocationCompact(data: OverpassMicroData | null): string {
  if (!data) return "—";
  const parts: string[] = [];
  if (data.building?.detail) parts.push(data.building.detail.split(" · ")[0] ?? "Gebäude");
  if (data.industrial.count > 0) parts.push(`${data.industrial.count} Gewerbe`);
  if (data.railway.count > 0) parts.push("Schiene nah");
  if (data.nightlife.count > 0) parts.push(`${data.nightlife.count} Bars/Clubs`);
  return parts.length > 0 ? parts.join(" · ") : "ruhige Mikrolage";
}

export async function fetchOverpassMicro(
  latitude: number,
  longitude: number,
  options?: { background?: boolean }
): Promise<
  | { ok: true; data: OverpassMicroData; noData?: boolean }
  | { ok: false; error: string }
> {
  const query = buildOverpassMicroQuery(latitude, longitude);
  const res = await fetchExternal(
    "overpass",
    OVERPASS_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "PickHome/1.0 (overpass micro; self-hosted)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(35_000),
    },
    options?.background ? { background: true } : undefined
  );

  if (!res) return { ok: false, error: "fetch_failed" };
  if (!res.ok) return { ok: false, error: `http_${res.status}` };

  let payload: { elements?: OverpassElement[] };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const data = parseOverpassMicroElements(payload.elements ?? [], latitude, longitude);
  const hasAny =
    data.building != null ||
    data.industrial.count > 0 ||
    data.majorRoad.count > 0 ||
    data.railway.count > 0 ||
    data.nightlife.count > 0;

  return { ok: true, data, noData: !hasAny };
}
