import { fetchExternal } from "@/lib/external-fetch";
import {
  buildGeocodeQueryVariants,
  looseGermanSearchQuery,
  parseLooseGermanAddress,
  pickBestHouseHit,
  type NominatimSearchHit,
} from "@/lib/geocode-address-queries";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  /** Best-effort suburb / city district from Nominatim (for area filter matching). */
  district: string | null;
  /** German PLZ when returned by Nominatim. */
  postcode: string | null;
  /** Normalized single-line address: «Straße Nr, Stadtteil, PLZ Ort». */
  canonicalAddress: string | null;
  displayName: string | null;
};

type NominatimAddress = Record<string, string>;

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

/** Insert PLZ before city when OSM returned one and the stored line has none. */
export function enrichAddressWithPostcode(address: string, postcode: string | null): string {
  const trimmed = address.trim();
  const plz = postcode?.trim();
  if (!trimmed || !plz || !/^\d{5}$/.test(plz)) return trimmed;
  if (/\b\d{5}\b/.test(trimmed)) return trimmed;

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[parts.length - 1]!;
    const before = parts.slice(0, -1).join(", ");
    return `${before}, ${plz} ${city}`;
  }

  return `${trimmed}, ${plz}`;
}

/** Build consistent stored address from Nominatim `address` parts. */
export function formatCanonicalGermanAddress(
  address: NominatimAddress | undefined
): string | null {
  if (!address) return null;

  const road = (address.road ?? address.pedestrian ?? address.footway)?.trim();
  const houseNumber = address.house_number?.trim();
  const streetPart = road ? (houseNumber ? `${road} ${houseNumber}` : road) : null;

  const district = districtFromNominatimAddress(address);
  const postcode = address.postcode?.trim();
  const city = (address.city ?? address.town ?? address.municipality ?? address.village)?.trim();

  const parts: string[] = [];
  if (streetPart) parts.push(streetPart);
  if (district) parts.push(district);
  if (postcode && city) parts.push(`${postcode} ${city}`);
  else if (city) parts.push(city);

  return parts.length > 0 ? parts.join(", ") : null;
}

function parseNominatimHit(hit: NominatimSearchHit | undefined): GeocodeResult | null {
  if (!hit?.lat || !hit?.lon) return null;
  const latitude = parseFloat(hit.lat);
  const longitude = parseFloat(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const postcode = hit.address?.postcode?.trim() || null;
  return {
    latitude,
    longitude,
    district: districtFromNominatimAddress(hit.address),
    postcode: postcode && /^\d{5}$/.test(postcode) ? postcode : null,
    canonicalAddress: formatCanonicalGermanAddress(hit.address),
    displayName: hit.display_name?.trim() || null,
  };
}

async function nominatimForwardSearch(
  q: string,
  limit: number
): Promise<NominatimSearchHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "de");

  const res = await fetchExternal("nominatim", url.toString(), {
    headers: NOMINATIM_HEADERS,
    next: { revalidate: 86400 },
  });
  if (!res?.ok) return [];
  return (await res.json()) as NominatimSearchHit[];
}

async function geocodeLooseGermanAddress(
  parsed: ReturnType<typeof parseLooseGermanAddress>
): Promise<GeocodeResult | null> {
  if (!parsed) return null;
  const hits = await nominatimForwardSearch(looseGermanSearchQuery(parsed), 8);
  const picked = parseNominatimHit(pickBestHouseHit(hits, parsed));
  if (picked) return picked;

  if (parsed.houseNumber) {
    const broadHits = await nominatimForwardSearch(
      `${parsed.houseNumber} ${parsed.city}, Deutschland`,
      25
    );
    return parseNominatimHit(pickBestHouseHit(broadHits, parsed));
  }

  return null;
}

/** Nominatim forward search (OpenStreetMap) — respect usage policy (max ~1 req/s). */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address.trim();
  if (!q) return null;

  for (const variant of buildGeocodeQueryVariants(q)) {
    const hits = await nominatimForwardSearch(variant, 1);
    const result = parseNominatimHit(hits[0]);
    if (result) return result;
  }

  return geocodeLooseGermanAddress(parseLooseGermanAddress(q));
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

function addressLineHasStreetWithNumber(line: string): boolean {
  const first = line.split(",")[0]?.trim() ?? "";
  return /\d/.test(first) && /[a-zA-ZäöüÄÖÜß]/.test(first);
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
  const canonical = geocode.canonicalAddress?.trim();
  const useCanonical =
    !!canonical &&
    (!addressLineHasStreetWithNumber(trimmed) ||
      addressLineHasStreetWithNumber(canonical));
  const addressLine = useCanonical
    ? canonical!
    : enrichAddressWithPostcode(
        enrichAddressWithDistrict(trimmed, geocode.district),
        geocode.postcode
      );
  return {
    address: addressLine,
    latitude: geocode.latitude,
    longitude: geocode.longitude,
  };
}
