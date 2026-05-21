import { fetchExternal } from "@/lib/external-fetch";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  /** Best-effort suburb / city district from Nominatim (for area filter matching). */
  district: string | null;
  displayName: string | null;
};

type NominatimAddress = Record<string, string>;

type NominatimSearchHit = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
};

const NOMINATIM_HEADERS = { "User-Agent": "PickHome/1.0 (local self-hosted)" };

const DISTRICT_ADDRESS_KEYS = [
  "suburb",
  "city_district",
  "borough",
  "neighbourhood",
  "quarter",
  "hamlet",
] as const;

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Pick the most specific district-like label from a Nominatim `address` object. */
export function districtFromNominatimAddress(
  address: NominatimAddress | undefined
): string | null {
  if (!address) return null;
  for (const key of DISTRICT_ADDRESS_KEYS) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return null;
}

/** Append OSM district to the address when missing (improves Wunschgebiet matching). */
export function enrichAddressWithDistrict(address: string, district: string | null): string {
  const trimmed = address.trim();
  if (!trimmed || !district?.trim()) return trimmed;

  const districtTrimmed = district.trim();
  const haystack = normalizeToken(trimmed);
  const needle = normalizeToken(districtTrimmed);
  if (!needle || haystack.includes(needle)) return trimmed;

  const plzMatch = trimmed.match(/\b(\d{5})\b/);
  if (plzMatch && plzMatch.index != null) {
    const before = trimmed.slice(0, plzMatch.index).replace(/[,;]\s*$/, "").trim();
    const after = trimmed.slice(plzMatch.index).trim();
    if (before) return `${before}, ${districtTrimmed}, ${after}`;
    return `${districtTrimmed}, ${after}`;
  }

  return `${trimmed}, ${districtTrimmed}`;
}

function parseNominatimHit(hit: NominatimSearchHit | undefined): GeocodeResult | null {
  if (!hit?.lat || !hit?.lon) return null;
  const latitude = parseFloat(hit.lat);
  const longitude = parseFloat(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    district: districtFromNominatimAddress(hit.address),
    displayName: hit.display_name?.trim() || null,
  };
}

/** Nominatim forward search (OpenStreetMap) — respect usage policy (max ~1 req/s). */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address.trim();
  if (!q) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetchExternal("nominatim", url.toString(), {
    headers: NOMINATIM_HEADERS,
    next: { revalidate: 86400 },
  });
  if (!res?.ok) return null;

  const data = (await res.json()) as NominatimSearchHit[];
  return parseNominatimHit(data[0]);
}

/** Nominatim reverse lookup from coordinates (same rate limits as forward search). */
export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number
): Promise<GeocodeResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  const res = await fetchExternal("nominatim", url.toString(), {
    headers: NOMINATIM_HEADERS,
    next: { revalidate: 86400 },
  });
  if (!res?.ok) return null;

  const data = (await res.json()) as NominatimSearchHit;
  return parseNominatimHit(data);
}

export function applyGeocodeToStoredAddress(
  address: string,
  geocode: GeocodeResult | null
): { address: string; latitude: number | null; longitude: number | null } {
  const trimmed = address.trim();
  if (!trimmed) {
    return { address: "", latitude: null, longitude: null };
  }
  if (!geocode) {
    return { address: trimmed, latitude: null, longitude: null };
  }
  return {
    address: enrichAddressWithDistrict(trimmed, geocode.district),
    latitude: geocode.latitude,
    longitude: geocode.longitude,
  };
}
