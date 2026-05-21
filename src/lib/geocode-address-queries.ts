/** Pure helpers for building and ranking Nominatim search queries (no network). */

export type LooseGermanAddress = {
  streetLine: string;
  houseNumber: string | null;
  city: string;
};

type NominatimAddress = Record<string, string>;

export type NominatimSearchHit = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
  class?: string;
  type?: string;
  place_rank?: number;
};

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/strasse/g, "str")
    .replace(/straße/g, "str")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Normalize common German address typing (Straße suffix, commas before city). */
export function normalizeGermanAddressInput(address: string): string {
  let s = address.trim().replace(/\s+/g, " ");
  s = s.replace(/\b(strasse|straße)\b/gi, "Straße");
  return s;
}

/** Parse "street 12 city" or "street 12, city" without PLZ. */
export function parseLooseGermanAddress(address: string): LooseGermanAddress | null {
  const trimmed = normalizeGermanAddressInput(address);
  if (!trimmed) return null;

  const commaParts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const last = commaParts[commaParts.length - 1]!;
    const plzCity = last.match(/^(\d{5})\s+(.+)$/i);
    if (plzCity) {
      const district = commaParts.slice(0, -1).join(", ");
      return {
        streetLine: district,
        houseNumber: null,
        city: `${plzCity[1]} ${capitalizeWord(plzCity[2]!)}`,
      };
    }

    const city = last;
    const streetPart = commaParts.slice(0, -1).join(", ");
    const numMatch = streetPart.match(/^(.+?)\s+(\d+[a-zA-Z]?)$/);
    if (numMatch) {
      return {
        streetLine: numMatch[1]!.trim(),
        houseNumber: numMatch[2]!,
        city: capitalizeWord(city),
      };
    }
    return { streetLine: streetPart, houseNumber: null, city: capitalizeWord(city) };
  }

  const loose = trimmed.match(/^(.+?)\s+(\d+[a-zA-Z]?)\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\-]*)$/);
  if (loose) {
    return {
      streetLine: loose[1]!.trim(),
      houseNumber: loose[2]!,
      city: capitalizeWord(loose[3]!),
    };
  }

  return null;
}

/** Ordered Nominatim `q` strings to try (first hit wins). */
export function buildGeocodeQueryVariants(address: string): string[] {
  const trimmed = address.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const add = (q: string) => {
    const t = q.trim();
    if (t) seen.add(t);
  };

  const normalized = normalizeGermanAddressInput(trimmed);
  add(trimmed);
  if (normalized !== trimmed) add(normalized);

  const parsed = parseLooseGermanAddress(trimmed);
  const districtPlzOnly =
    parsed != null && !parsed.houseNumber && /^\d{5}\s/.test(parsed.city);

  if (parsed) {
    const streetWithNum = parsed.houseNumber
      ? `${parsed.streetLine} ${parsed.houseNumber}`
      : parsed.streetLine;
    add(`${streetWithNum}, ${parsed.city}`);
    if (!districtPlzOnly) {
      add(`${streetWithNum}, ${parsed.city}, Deutschland`);
    }
  }

  if (!/\b(deutschland|germany)\b/i.test(trimmed)) {
    add(`${normalized}, Deutschland`);
    if (parsed && !districtPlzOnly) {
      const streetWithNum = parsed.houseNumber
        ? `${parsed.streetLine} ${parsed.houseNumber}`
        : parsed.streetLine;
      add(`${streetWithNum}, ${parsed.city}, Deutschland`);
    }
  }

  return [...seen];
}

/** District + PLZ city lines (no street number), e.g. «Nordstadt, 99999 Teststadt». */
export function isDistrictPlzGermanAddress(address: string): boolean {
  const parsed = parseLooseGermanAddress(address.trim());
  return parsed != null && !parsed.houseNumber && /^\d{5}\s/.test(parsed.city);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur =
        a[i] === b[j]
          ? row[j]!
          : Math.min(row[j]! + 1, row[j + 1]! + 1, prev + 1);
      row[j] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length]!;
}

/** 0–1 similarity for matching a user-typed street to Nominatim `road`. */
export function streetSimilarity(inputStreet: string, candidateRoad: string | undefined): number {
  if (!candidateRoad?.trim()) return 0;
  const a = normalizeToken(inputStreet);
  const b = normalizeToken(candidateRoad);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

function cityMatches(parsedCity: string, hit: NominatimSearchHit): boolean {
  const target = normalizeToken(parsedCity);
  const addr = hit.address;
  if (!addr) return false;
  const candidates = [addr.city, addr.town, addr.municipality, addr.village, addr.state]
    .filter(Boolean)
    .map((c) => normalizeToken(c!));
  return candidates.some((c) => c === target || c.includes(target) || target.includes(c));
}

const MIN_STREET_SIMILARITY = 0.82;

/** Pick the best house-level hit when the exact query string misses (e.g. street typo). */
export function pickBestHouseHit(
  hits: NominatimSearchHit[],
  parsed: LooseGermanAddress
): NominatimSearchHit | undefined {
  let best: { hit: NominatimSearchHit; score: number } | undefined;

  for (const hit of hits) {
    if (!hit.lat || !hit.lon || !hit.address) continue;
    if (!cityMatches(parsed.city, hit)) continue;

    const road = hit.address.road ?? hit.address.pedestrian ?? hit.address.footway;
    const sim = streetSimilarity(parsed.streetLine, road);
    if (sim < MIN_STREET_SIMILARITY) continue;

    const houseMatch =
      !parsed.houseNumber ||
      hit.address.house_number === parsed.houseNumber ||
      normalizeToken(hit.address.house_number ?? "") === normalizeToken(parsed.houseNumber);

    if (!houseMatch) continue;

    const rankBonus =
      hit.type === "house" || hit.class === "place" ? 0.15 : hit.type === "residential" ? 0.05 : 0;
    const score = sim + rankBonus + (hit.place_rank != null ? Math.max(0, 0.1 - hit.place_rank / 100) : 0);

    if (!best || score > best.score) {
      best = { hit, score };
    }
  }

  return best?.hit;
}

/** Suburb-level hit when the user only gave district + PLZ + city. */
export function pickBestDistrictPlzHit(
  hits: NominatimSearchHit[],
  parsed: LooseGermanAddress
): NominatimSearchHit | undefined {
  const plzMatch = parsed.city.match(/^(\d{5})\s+(.+)$/i);
  if (!plzMatch) return undefined;
  const targetPlz = plzMatch[1]!;
  const targetCity = plzMatch[2]!;
  const districtNeedle = normalizeToken(parsed.streetLine);

  let best: { hit: NominatimSearchHit; score: number } | undefined;

  for (const hit of hits) {
    if (!hit.lat || !hit.lon || !hit.address) continue;
    const postcode = hit.address.postcode?.trim();
    if (postcode !== targetPlz) continue;
    if (!cityMatches(targetCity, hit)) continue;

    const district = districtFromHit(hit);
    const districtSim =
      district && districtNeedle
        ? normalizeToken(district) === districtNeedle
          ? 1
          : normalizeToken(district).includes(districtNeedle) ||
              districtNeedle.includes(normalizeToken(district))
            ? 0.85
            : 0
        : 0.4;

    const rankBonus =
      hit.type === "suburb" || hit.type === "neighbourhood" || hit.class === "place" ? 0.2 : 0;
    const score = districtSim + rankBonus;

    if (!best || score > best.score) {
      best = { hit, score };
    }
  }

  return best?.hit;
}

function districtFromHit(hit: NominatimSearchHit): string | null {
  const addr = hit.address;
  if (!addr) return null;
  for (const key of ["suburb", "city_district", "borough", "neighbourhood", "quarter"] as const) {
    const value = addr[key]?.trim();
    if (value) return value;
  }
  return null;
}

/** Relaxed forward-search query for typo-tolerant matching. */
export function looseGermanSearchQuery(parsed: LooseGermanAddress): string {
  const streetWithNum = parsed.houseNumber
    ? `${parsed.streetLine} ${parsed.houseNumber}`
    : parsed.streetLine;
  return `${streetWithNum}, ${parsed.city}, Deutschland`;
}
