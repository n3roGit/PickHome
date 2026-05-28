import { fetchExternal } from "@/lib/external-fetch";
import { distanceMeters } from "@/lib/geo-coords";
import {
  buildOverpassMicroQueryParts,
  collectMicroMapMarkers,
  parseOverpassMicroElements,
  type OverpassMicroData,
} from "@/lib/overpass-micro";

export const OVERPASS_API_URL =
  process.env.OVERPASS_URL?.trim() || "https://overpass-api.de/api/interpreter";

export const OVERPASS_RADIUS_CLOSE_M = 500;
export const OVERPASS_RADIUS_WIDE_M = 1000;

export type PoiCategoryId =
  | "supermarket"
  | "pharmacy"
  | "school"
  | "kindergarten"
  | "publicTransport"
  | "park"
  | "medical"
  | "building"
  | "industrial"
  | "majorRoad"
  | "railway"
  | "nightlife";

export type PoiNearest = {
  name: string | null;
  distanceM: number;
  lat: number;
  lng: number;
  osmType: string;
  osmId: number;
};

export type PoiCategorySummary = {
  countClose: number;
  countWide: number;
  nearest: PoiNearest | null;
};

export type PoiMarker = {
  categoryId: PoiCategoryId;
  name: string | null;
  distanceM: number;
  lat: number;
  lng: number;
  osmType: string;
  osmId: number;
};

export type OverpassPoiData = {
  radii: { close: number; wider: number };
  categories: Record<PoiCategoryId, PoiCategorySummary>;
  /** All POIs within the wide radius for map display; optional in older cache rows. */
  markers?: PoiMarker[];
  /** Mikrolage summary from the same Overpass fetch (optional in older cache rows). */
  micro?: OverpassMicroData;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const CATEGORY_DEFS: {
  id: PoiCategoryId;
  label: string;
  filter: string;
}[] = [
  {
    id: "supermarket",
    label: "Supermarkt",
    filter: `node["shop"="supermarket"](around:{r},{lat},{lon});way["shop"="supermarket"](around:{r},{lat},{lon});`,
  },
  {
    id: "pharmacy",
    label: "Apotheke",
    filter: `node["amenity"="pharmacy"](around:{r},{lat},{lon});`,
  },
  {
    id: "school",
    label: "Schule",
    filter: `node["amenity"="school"](around:{r},{lat},{lon});way["amenity"="school"](around:{r},{lat},{lon});`,
  },
  {
    id: "kindergarten",
    label: "Kita",
    filter: `node["amenity"="kindergarten"](around:{r},{lat},{lon});`,
  },
  {
    id: "publicTransport",
    label: "ÖPNV",
    filter: `node["highway"="bus_stop"](around:{r},{lat},{lon});node["railway"~"^(station|halt|tram_stop)$"](around:{r},{lat},{lon});`,
  },
  {
    id: "park",
    label: "Grünfläche",
    filter: `node["leisure"="park"](around:{r},{lat},{lon});way["leisure"="park"](around:{r},{lat},{lon});`,
  },
  {
    id: "medical",
    label: "Gesundheit",
    filter: `node["amenity"~"^(doctors|clinic|hospital)$"](around:{r},{lat},{lon});`,
  },
];

const MICRO_CATEGORY_DEFS: { id: PoiCategoryId; label: string }[] = [
  { id: "building", label: "Gebäude" },
  { id: "industrial", label: "Gewerbe/Industrie" },
  { id: "majorRoad", label: "Hauptstraße" },
  { id: "railway", label: "Schiene" },
  { id: "nightlife", label: "Bar/Club" },
];

function buildOverpassQuery(latitude: number, longitude: number, radiusM: number): string {
  const poiParts = CATEGORY_DEFS.map((def) =>
    def.filter
      .replace(/\{r\}/g, String(radiusM))
      .replace(/\{lat\}/g, String(latitude))
      .replace(/\{lon\}/g, String(longitude))
  ).join("");
  const microParts = buildOverpassMicroQueryParts(latitude, longitude);
  return `[out:json][timeout:35];(${poiParts}${microParts});out center tags;`;
}

function elementCoords(el: OverpassElement): { lat: number; lng: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function elementMatchesCategory(el: OverpassElement, categoryId: PoiCategoryId): boolean {
  const tags = el.tags ?? {};
  switch (categoryId) {
    case "supermarket":
      return tags.shop === "supermarket";
    case "pharmacy":
      return tags.amenity === "pharmacy";
    case "school":
      return tags.amenity === "school";
    case "kindergarten":
      return tags.amenity === "kindergarten";
    case "publicTransport":
      return (
        tags.highway === "bus_stop" ||
        tags.railway === "station" ||
        tags.railway === "halt" ||
        tags.railway === "tram_stop"
      );
    case "park":
      return tags.leisure === "park";
    case "medical":
      return (
        tags.amenity === "doctors" ||
        tags.amenity === "clinic" ||
        tags.amenity === "hospital"
      );
    default:
      return false;
  }
}

function summarizeCategory(
  elements: OverpassElement[],
  categoryId: PoiCategoryId,
  originLat: number,
  originLng: number,
  radiusClose: number,
  radiusWide: number
): PoiCategorySummary {
  const matches = elements.filter((el) => elementMatchesCategory(el, categoryId));
  let countClose = 0;
  let countWide = 0;
  let nearest: PoiNearest | null = null;

  for (const el of matches) {
    const coords = elementCoords(el);
    if (!coords) continue;
    const dist = Math.round(distanceMeters(originLat, originLng, coords.lat, coords.lng));
    if (dist <= radiusWide) countWide += 1;
    if (dist <= radiusClose) countClose += 1;
    const name = el.tags?.name?.trim() || null;
    if (!nearest || dist < nearest.distanceM) {
      nearest = {
        name,
        distanceM: dist,
        lat: coords.lat,
        lng: coords.lng,
        osmType: el.type,
        osmId: el.id,
      };
    }
  }

  return { countClose, countWide, nearest };
}

function categoryForElement(el: OverpassElement): PoiCategoryId | null {
  for (const def of CATEGORY_DEFS) {
    if (elementMatchesCategory(el, def.id)) return def.id;
  }
  return null;
}

function collectMarkers(
  elements: OverpassElement[],
  originLat: number,
  originLng: number,
  radiusWide: number
): PoiMarker[] {
  const markers: PoiMarker[] = [];
  for (const el of elements) {
    const categoryId = categoryForElement(el);
    if (!categoryId) continue;
    const coords = elementCoords(el);
    if (!coords) continue;
    const distanceM = Math.round(distanceMeters(originLat, originLng, coords.lat, coords.lng));
    if (distanceM > radiusWide) continue;
    markers.push({
      categoryId,
      name: el.tags?.name?.trim() || null,
      distanceM,
      lat: coords.lat,
      lng: coords.lng,
      osmType: el.type,
      osmId: el.id,
    });
  }
  return markers;
}

/** Markers for map when cache predates the markers field (nearest POI per category only). */
export function markersForMap(data: OverpassPoiData): PoiMarker[] {
  if (data.markers && data.markers.length > 0) return data.markers;
  const fallback: PoiMarker[] = [];
  for (const def of CATEGORY_DEFS) {
    const nearest = data.categories[def.id].nearest;
    if (nearest) {
      fallback.push({ categoryId: def.id, ...nearest });
    }
  }
  return fallback;
}

function summarizeMicroCategory(
  markers: PoiMarker[],
  categoryId: PoiCategoryId
): PoiCategorySummary {
  const matches = markers.filter((m) => m.categoryId === categoryId);
  let countClose = 0;
  let countWide = 0;
  let nearest: PoiNearest | null = null;
  for (const marker of matches) {
    if (marker.distanceM <= OVERPASS_RADIUS_CLOSE_M) countClose += 1;
    if (marker.distanceM <= OVERPASS_RADIUS_WIDE_M) countWide += 1;
    if (!nearest || marker.distanceM < nearest.distanceM) {
      nearest = {
        name: marker.name,
        distanceM: marker.distanceM,
        lat: marker.lat,
        lng: marker.lng,
        osmType: marker.osmType,
        osmId: marker.osmId,
      };
    }
  }
  return { countClose, countWide, nearest };
}

function microMarkersToPoiMarkers(
  latitude: number,
  longitude: number,
  elements: OverpassElement[]
): PoiMarker[] {
  return collectMicroMapMarkers(elements, latitude, longitude).map((marker) => ({
    categoryId: marker.categoryId,
    name: marker.name,
    distanceM: marker.distanceM,
    lat: marker.lat,
    lng: marker.lng,
    osmType: marker.osmType,
    osmId: marker.osmId,
  }));
}

function emptyCategories(): Record<PoiCategoryId, PoiCategorySummary> {
  const out = {} as Record<PoiCategoryId, PoiCategorySummary>;
  for (const def of [...CATEGORY_DEFS, ...MICRO_CATEGORY_DEFS]) {
    out[def.id] = { countClose: 0, countWide: 0, nearest: null };
  }
  return out;
}

export async function fetchOverpassPois(
  latitude: number,
  longitude: number,
  options?: { background?: boolean }
): Promise<
  | { ok: true; data: OverpassPoiData; noData?: boolean }
  | { ok: false; error: string }
> {
  const query = buildOverpassQuery(latitude, longitude, OVERPASS_RADIUS_WIDE_M);
  const res = await fetchExternal(
    "overpass",
    OVERPASS_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "PickHome/1.0 (overpass; self-hosted)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(40_000),
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

  const elements = payload.elements ?? [];
  const categories = emptyCategories();
  for (const def of CATEGORY_DEFS) {
    categories[def.id] = summarizeCategory(
      elements,
      def.id,
      latitude,
      longitude,
      OVERPASS_RADIUS_CLOSE_M,
      OVERPASS_RADIUS_WIDE_M
    );
  }

  const infraMarkers = collectMarkers(
    elements,
    latitude,
    longitude,
    OVERPASS_RADIUS_WIDE_M
  );
  const microMarkers = microMarkersToPoiMarkers(latitude, longitude, elements);
  for (const def of MICRO_CATEGORY_DEFS) {
    categories[def.id] = summarizeMicroCategory(microMarkers, def.id);
  }
  const markers = [...infraMarkers, ...microMarkers];
  const micro = parseOverpassMicroElements(elements, latitude, longitude);
  const hasAny =
    markers.length > 0 ||
    micro.building != null ||
    micro.industrial.count > 0 ||
    micro.majorRoad.count > 0 ||
    micro.railway.count > 0 ||
    micro.nightlife.count > 0;
  return {
    ok: true,
    data: {
      radii: { close: OVERPASS_RADIUS_CLOSE_M, wider: OVERPASS_RADIUS_WIDE_M },
      categories,
      markers,
      micro,
    },
    noData: !hasAny,
  };
}

export const POI_CATEGORY_ORDER: PoiCategoryId[] = [
  ...CATEGORY_DEFS.map((d) => d.id),
  ...MICRO_CATEGORY_DEFS.map((d) => d.id),
];

export const POI_CATEGORY_LABELS: Record<PoiCategoryId, string> = Object.fromEntries(
  [...CATEGORY_DEFS, ...MICRO_CATEGORY_DEFS].map((d) => [d.id, d.label])
) as Record<PoiCategoryId, string>;

export function countPoisByCategory(
  markers: { categoryId: PoiCategoryId }[]
): Record<PoiCategoryId, number> {
  const counts = Object.fromEntries(POI_CATEGORY_ORDER.map((id) => [id, 0])) as Record<
    PoiCategoryId,
    number
  >;
  for (const m of markers) {
    counts[m.categoryId] += 1;
  }
  return counts;
}

export const POI_CATEGORY_COLORS: Record<PoiCategoryId, string> = {
  supermarket: "#16a34a",
  pharmacy: "#db2777",
  school: "#2563eb",
  kindergarten: "#7c3aed",
  publicTransport: "#ea580c",
  park: "#059669",
  medical: "#dc2626",
  building: "#64748b",
  industrial: "#78716c",
  majorRoad: "#475569",
  railway: "#0d9488",
  nightlife: "#9333ea",
};

export function osmLinkForPoi(poi: PoiNearest): string {
  return `https://www.openstreetmap.org/${poi.osmType}/${poi.osmId}`;
}

export function formatPoiEnvironmentCompact(data: OverpassPoiData | null): string {
  if (!data) return "—";
  const parts: string[] = [];
  const order: PoiCategoryId[] = [
    "supermarket",
    "publicTransport",
    "school",
    "pharmacy",
    "park",
  ];
  for (const id of order) {
    const c = data.categories[id];
    if (c.countWide > 0) {
      parts.push(`${c.countWide} ${POI_CATEGORY_LABELS[id]}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "keine POIs im Umkreis";
}
