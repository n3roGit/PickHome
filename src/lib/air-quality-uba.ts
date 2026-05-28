import { distanceMeters } from "@/lib/geo-coords";
import { fetchExternal } from "@/lib/external-fetch";

export const UBA_AIR_DATA_SOURCE_URL =
  "https://www.umweltbundesamt.de/daten/luft/luftdaten";

const UBA_API_PROXY = "https://luftdaten.umweltbundesamt.de/api-proxy";

const STATION_INDICES = {
  id: 0,
  code: 1,
  name: 2,
  city: 3,
  activeTo: 6,
  lon: 7,
  lat: 8,
} as const;

export type AirQualityComponentMeta = {
  id: number;
  code: string;
  symbol: string;
  unit: string;
  name: string;
};

export type AirQualityMeasurement = {
  componentId: number;
  code: string;
  label: string;
  unit: string;
  indexClassId: number;
  value: number;
  valueDisplay: string;
  assessment: string;
};

export type AirQualityUbaData = {
  stationCode: string;
  stationName: string;
  stationCity: string;
  distanceM: number;
  measuredAt: string;
  measurements: AirQualityMeasurement[];
  headline: string;
};

type UbaStationsPayload = {
  indices: string[];
  data: Record<string, string[]>;
};

type UbaComponentsPayload = {
  indices: string[];
  [key: string]: unknown;
};

type UbaAirQualityPayload = {
  data: Record<string, Record<string, unknown>>;
};

let stationsCache: { fetchedAt: number; stations: UbaStation[] } | null = null;
let componentsCache: Map<number, AirQualityComponentMeta> | null = null;

const STATIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type UbaStation = {
  id: string;
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
};

function parseNumber(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function assessAirIndexValue(value: number): string {
  if (value <= 1) return "sehr gut";
  if (value <= 2) return "gut";
  if (value <= 3) return "mäßig";
  if (value <= 4) return "schlecht";
  return "sehr schlecht";
}

export function parseUbaComponentMeta(payload: UbaComponentsPayload): Map<number, AirQualityComponentMeta> {
  const map = new Map<number, AirQualityComponentMeta>();
  for (const [key, row] of Object.entries(payload)) {
    if (!/^\d+$/.test(key) || !Array.isArray(row)) continue;
    const id = parseInt(row[0] as string, 10);
    map.set(id, {
      id,
      code: String(row[1] ?? ""),
      symbol: String(row[2] ?? ""),
      unit: String(row[3] ?? ""),
      name: String(row[4] ?? ""),
    });
  }
  return map;
}

export function parseUbaStations(payload: UbaStationsPayload): UbaStation[] {
  const out: UbaStation[] = [];
  for (const row of Object.values(payload.data)) {
    if (!Array.isArray(row)) continue;
    const activeTo = row[STATION_INDICES.activeTo];
    if (activeTo != null && String(activeTo).trim() !== "") continue;
    const lat = parseNumber(String(row[STATION_INDICES.lat]));
    const lon = parseNumber(String(row[STATION_INDICES.lon]));
    if (lat == null || lon == null) continue;
    out.push({
      id: String(row[STATION_INDICES.id]),
      code: String(row[STATION_INDICES.code]),
      name: String(row[STATION_INDICES.name]),
      city: String(row[STATION_INDICES.city]),
      lat,
      lon,
    });
  }
  return out;
}

export function rankAirStationsByDistance(
  stations: UbaStation[],
  latitude: number,
  longitude: number,
  limit = 5
): { station: UbaStation; distanceM: number }[] {
  return stations
    .map((station) => ({
      station,
      distanceM: Math.round(distanceMeters(latitude, longitude, station.lat, station.lon)),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

export function findNearestAirStation(
  stations: UbaStation[],
  latitude: number,
  longitude: number
): { station: UbaStation; distanceM: number } | null {
  return rankAirStationsByDistance(stations, latitude, longitude, 1)[0] ?? null;
}

function isMeasurementTuple(value: unknown): value is [number, number, number, string] {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    typeof value[3] === "string"
  );
}

export function parseLatestHourMeasurements(
  stationData: Record<string, unknown>,
  components: Map<number, AirQualityComponentMeta>
): { measuredAt: string; measurements: AirQualityMeasurement[] } | null {
  const hourKeys = Object.keys(stationData)
    .filter((k) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(k))
    .sort();
  if (hourKeys.length === 0) return null;

  const latestKey = hourKeys[hourKeys.length - 1]!;
  const row = stationData[latestKey];
  if (!Array.isArray(row)) return null;

  const measurements: AirQualityMeasurement[] = [];
  for (const entry of row.slice(3)) {
    if (!isMeasurementTuple(entry)) continue;
    const [componentId, indexClassId, , valueRaw] = entry;
    const value = parseNumber(valueRaw);
    if (value == null) continue;
    const meta = components.get(componentId);
    const code = meta?.code ?? `C${componentId}`;
    const label = meta?.symbol || meta?.name || code;
    const unit = meta?.unit ?? "";
    measurements.push({
      componentId,
      code,
      label,
      unit,
      indexClassId,
      value,
      valueDisplay: valueRaw,
      assessment: assessAirIndexValue(value),
    });
  }

  if (measurements.length === 0) return null;
  return { measuredAt: latestKey, measurements };
}

export function buildAirQualityHeadline(measurements: AirQualityMeasurement[]): string {
  const priority = ["PM2", "NO2", "PM10", "O3"];
  const sorted = [...measurements].sort((a, b) => {
    const ai = priority.indexOf(a.code);
    const bi = priority.indexOf(b.code);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const lead = sorted[0];
  if (!lead) return "Keine aktuellen Messwerte an der nächsten Station.";
  return `An der Messstation: ${lead.label} Index ${lead.valueDisplay} (${lead.assessment}).`;
}

export function formatAirQualityCompact(data: AirQualityUbaData | null): string {
  if (!data?.measurements.length) return "—";
  const lead = data.measurements.find((m) => m.code === "PM2") ?? data.measurements[0];
  return `${lead.label} ${lead.assessment}`;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const res = await fetchExternal("air", `${UBA_API_PROXY}/${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function loadStations(): Promise<UbaStation[]> {
  const now = Date.now();
  if (stationsCache && now - stationsCache.fetchedAt < STATIONS_TTL_MS) {
    return stationsCache.stations;
  }
  const payload = await fetchJson<UbaStationsPayload>("stations/json");
  if (!payload?.data) return stationsCache?.stations ?? [];
  const stations = parseUbaStations(payload);
  stationsCache = { fetchedAt: now, stations };
  return stations;
}

async function loadComponents(): Promise<Map<number, AirQualityComponentMeta>> {
  if (componentsCache) return componentsCache;
  const payload = await fetchJson<UbaComponentsPayload>("components/json");
  if (!payload) return new Map();
  componentsCache = parseUbaComponentMeta(payload);
  return componentsCache;
}

function berlinDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function fetchAirQualityUbaForCoords(
  latitude: number,
  longitude: number
): Promise<
  | { ok: true; data: AirQualityUbaData; noData?: boolean }
  | { ok: false; error: string }
> {
  const [stations, components] = await Promise.all([loadStations(), loadComponents()]);
  if (stations.length === 0) return { ok: false, error: "stations_unavailable" };

  const ranked = rankAirStationsByDistance(stations, latitude, longitude, 5);
  if (ranked.length === 0) return { ok: false, error: "no_station" };

  const today = berlinDateString();
  let lastCandidate: { station: UbaStation; distanceM: number } | null = null;

  for (const candidate of ranked) {
    lastCandidate = candidate;
    const params = new URLSearchParams({
      date_from: today,
      date_to: today,
      time_from: "1",
      time_to: "24",
      station: candidate.station.code,
    });
    const payload = await fetchJson<UbaAirQualityPayload>(
      `airquality/json?${params.toString()}`
    );
    if (!payload?.data) continue;

    const stationData =
      payload.data[candidate.station.id] ?? payload.data[candidate.station.code];
    if (!stationData) continue;

    const parsed = parseLatestHourMeasurements(stationData, components);
    if (!parsed || parsed.measurements.length === 0) continue;

    const data: AirQualityUbaData = {
      stationCode: candidate.station.code,
      stationName: candidate.station.name,
      stationCity: candidate.station.city,
      distanceM: candidate.distanceM,
      measuredAt: parsed.measuredAt,
      measurements: parsed.measurements,
      headline: buildAirQualityHeadline(parsed.measurements),
    };
    return { ok: true, data };
  }

  const fallback = lastCandidate ?? ranked[0]!;
  return {
    ok: true,
    data: buildEmptyAirData(fallback),
    noData: true,
  };
}

function buildEmptyAirData(nearest: {
  station: UbaStation;
  distanceM: number;
}): AirQualityUbaData {
  return {
    stationCode: nearest.station.code,
    stationName: nearest.station.name,
    stationCity: nearest.station.city,
    distanceM: nearest.distanceM,
    measuredAt: "",
    measurements: [],
    headline: "Keine aktuellen Stundenwerte an der nächsten Station.",
  };
}

/** @internal Reset module caches (tests only). */
export function resetAirQualityUbaCachesForTests(): void {
  stationsCache = null;
  componentsCache = null;
}
