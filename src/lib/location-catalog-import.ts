export type ParsedCatalogRow = {
  plz: string;
  cityName: string | null;
  districts: string[];
};

export type ParsedCatalogImport = {
  cityName: string;
  rows: ParsedCatalogRow[];
};

function splitDistricts(raw: string): string[] {
  return [...new Set(raw.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de")
  );
}

function parseLine(line: string): ParsedCatalogRow | null {
  const trimmed = line.trim();
  if (!trimmed || /^[-|:\s]+$/.test(trimmed)) return null;
  if (/^plz\b/i.test(trimmed) || /^postleitzahl/i.test(trimmed)) return null;

  const plzMatch = trimmed.match(/\b(\d{5})\b/);
  if (!plzMatch) return null;
  const plz = plzMatch[1];

  const withoutPlz = trimmed.replace(plz, " ").replace(/^\|+|\|+$/g, "").trim();
  const pipeParts = withoutPlz
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  if (pipeParts.length >= 2) {
    const cityName = pipeParts[0] || null;
    const districts = splitDistricts(pipeParts.slice(1).join(", "));
    if (districts.length === 0) return null;
    return { plz, cityName, districts };
  }

  const commaParts = withoutPlz
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length >= 1) {
    const districts = splitDistricts(commaParts.join(", "));
    if (districts.length === 0) return null;
    return { plz, cityName: null, districts };
  }

  const districts = splitDistricts(withoutPlz);
  if (districts.length === 0) return null;
  return { plz, cityName: null, districts };
}

export function parseLocationCatalogImport(
  raw: string,
  fallbackCityName: string
): ParsedCatalogImport | null {
  const cityName = fallbackCityName.trim();
  if (!cityName) return null;

  const rows: ParsedCatalogRow[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const row = parseLine(line);
    if (row) rows.push(row);
  }

  if (rows.length === 0) return null;

  const resolvedCity =
    rows.find((r) => r.cityName)?.cityName?.trim() || cityName;

  return { cityName: resolvedCity, rows };
}

export function serializeProjectAreaDistrictsImport(
  districtsByPlz: Record<string, string[]>,
  cityName?: string | null
): string {
  return Object.entries(districtsByPlz)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([plz, districts]) => {
      const list = districts.join(", ");
      const city = cityName?.trim();
      return city ? `${plz} | ${city} | ${list}` : `${plz} | ${list}`;
    })
    .join("\n");
}
