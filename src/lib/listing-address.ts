/** Heuristics to prefer property location over broker office addresses in listings. */

const BROKER_OFFICE_RE =
  /immobilien|makler|gmbh|co\.\s*kg|elisabethstr|beruf|courtage|provision|handelsregister/i;

export function isBrokerOfficeAddress(address: string): boolean {
  return BROKER_OFFICE_RE.test(address);
}

/** e.g. "City-District" in title or JSON-LD name */
export function extractDistrictFromListingTitle(title: string | undefined): string | undefined {
  if (!title?.trim()) return undefined;
  const inCity = title.match(/\bin\s+([A-ZÄÖÜ][a-zäöüß]+)-([A-ZÄÖÜ][a-zäöüß]+)\b/i);
  if (inCity) return inCity[2];
  const m = title.match(/\b([A-ZÄÖÜ][a-zäöüß]+)-([A-ZÄÖÜ][a-zäöüß]+)\b/);
  if (!m) return undefined;
  return m[2];
}

export function formatPlzCityAddress(
  postalCode: string,
  city: string,
  district?: string
): string {
  const base = `${postalCode} ${city}`.trim();
  if (district?.trim()) return `${district.trim()}, ${base}`;
  return base;
}

/** JSON-LD on some portals contains raw newlines and breaks JSON.parse — extract fields with regex. */
export function extractRelaxedJsonLdListingName(html: string): string | undefined {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    const raw = block[1];
    if (!/SingleFamilyResidence|Apartment|House|Residence/i.test(raw)) continue;
    const name = raw.match(/"name"\s*:\s*"([^"]{8,220})"/)?.[1]?.trim();
    if (name && /wohnung|haus|reihen|immobil|vorankündigung|zimmer/i.test(name)) {
      return name.slice(0, 200);
    }
  }
  return undefined;
}

export function extractRelaxedJsonLdPropertyAddress(html: string): string | undefined {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    const raw = block[1];
    if (!/SingleFamilyResidence|Apartment|House|Residence|Product/i.test(raw)) continue;

    const postalCode = raw.match(/"postalCode"\s*:\s*"(\d{5})"/)?.[1];
    const locality = raw.match(/"addressLocality"\s*:\s*"([^"]+)"/)?.[1];
    const street = raw.match(/"streetAddress"\s*:\s*"([^"]+)"/)?.[1];
    const name = raw.match(/"name"\s*:\s*"([^"]{8,200})"/)?.[1];

    if (street?.trim() && !isBrokerOfficeAddress(street)) {
      const parts = [street.trim(), postalCode, locality].filter(Boolean);
      if (parts.length) return parts.join(", ").slice(0, 300);
    }

    if (postalCode && locality) {
      const district =
        extractDistrictFromListingTitle(name) ??
        raw.match(/in\s+([A-ZÄÖÜ][a-zäöüß]+)-([A-ZÄÖÜ][a-zäöüß]+)/i)?.[2];
      return formatPlzCityAddress(postalCode, locality, district).slice(0, 300);
    }
  }
  return undefined;
}

export function extractPlzCityCandidates(text: string): { value: string; index: number }[] {
  const seen = new Set<string>();
  const out: { value: string; index: number }[] = [];
  const re = /\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß\-]+(?:\s*\([^)]+\))?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = `${m[1]} ${m[2].replace(/\s+/g, " ").trim()}`;
    if (seen.has(value) || isBrokerOfficeAddress(value)) continue;
    seen.add(value);
    out.push({ value, index: m.index ?? 0 });
  }
  return out;
}

export function pickPropertyListingAddress(options: {
  title?: string;
  textBlob: string;
  jsonLdAddress?: string;
  relaxedJsonLdAddress?: string;
  heuristicStreet?: string;
}): string | undefined {
  const district = extractDistrictFromListingTitle(options.title);

  if (options.relaxedJsonLdAddress && !isBrokerOfficeAddress(options.relaxedJsonLdAddress)) {
    return options.relaxedJsonLdAddress;
  }

  if (options.jsonLdAddress && !isBrokerOfficeAddress(options.jsonLdAddress)) {
    const plz = options.jsonLdAddress.match(/\b(\d{5})\b/)?.[1];
    const city = options.jsonLdAddress.match(/\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß\-]+)/)?.[2];
    if (plz && city && district && !options.jsonLdAddress.includes(district)) {
      return formatPlzCityAddress(plz, city, district);
    }
    return options.jsonLdAddress;
  }

  const plzCandidates = extractPlzCityCandidates(options.textBlob);
  if (plzCandidates.length > 0) {
    const brokerIdx = options.textBlob.toLowerCase().indexOf("elisabethstr");
    const scored = plzCandidates.map((c) => {
      let score = 0;
      if (brokerIdx >= 0 && c.index < brokerIdx) score += 10;
      if (district && c.value.includes(district)) score += 8;
      const plz = c.value.match(/^(\d{5})/)?.[1];
      if (plz && options.title?.includes(plz)) score += 6;
      return { ...c, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const plz = best.value.match(/^(\d{5})/)?.[1];
    const city = best.value.match(/^\d{5}\s+(.+)$/)?.[1];
    if (plz && city) {
      return formatPlzCityAddress(plz, city, district);
    }
    return best.value;
  }

  if (options.heuristicStreet && !isBrokerOfficeAddress(options.heuristicStreet)) {
    return options.heuristicStreet;
  }

  return undefined;
}
