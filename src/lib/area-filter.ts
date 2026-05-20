import { extractGermanPlz } from "@/lib/federal-state-from-address";
import { staticDistrictsForPlz } from "@/lib/ortsteile-reference";

export type AreaFilterConfig = {
  selectedPlz: string[];
  selectedDistricts: string[];
};

export type AreaMatchStatus = "inside" | "outside" | "unknown" | "unset";

export type AreaMatchResult = {
  status: AreaMatchStatus;
  plz: string | null;
  district: string | null;
};

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseAreaFilterConfig(raw: string | null | undefined): AreaFilterConfig | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as Partial<AreaFilterConfig>;
    if (!data || !Array.isArray(data.selectedPlz) || !Array.isArray(data.selectedDistricts)) {
      return null;
    }
    return {
      selectedPlz: [...new Set(data.selectedPlz.map(String))].sort(),
      selectedDistricts: [...new Set(data.selectedDistricts.map(String))].sort((a, b) =>
        a.localeCompare(b, "de")
      ),
    };
  } catch {
    return null;
  }
}

export function serializeAreaFilterConfig(config: AreaFilterConfig): string {
  return JSON.stringify({
    selectedPlz: [...config.selectedPlz].sort(),
    selectedDistricts: [...config.selectedDistricts].sort((a, b) => a.localeCompare(b, "de")),
  });
}

export function isAreaFilterActive(
  ortKey: string | null | undefined,
  config: AreaFilterConfig | null
): boolean {
  if (!ortKey || !config) return false;
  return config.selectedPlz.length > 0;
}

export function extractDistrictFromAddress(
  address: string,
  candidateDistricts: string[]
): string | null {
  const haystack = normalizeForMatch(address);
  if (!haystack) return null;

  const sorted = [...candidateDistricts].sort(
    (a, b) => normalizeForMatch(b).length - normalizeForMatch(a).length
  );

  for (const district of sorted) {
    const needle = normalizeForMatch(district);
    if (needle.length >= 3 && haystack.includes(needle)) {
      return district;
    }
    const altNeedle = needle.replace(/\//g, " ");
    if (altNeedle !== needle && altNeedle.length >= 3 && haystack.includes(altNeedle)) {
      return district;
    }
  }

  return null;
}

export function districtsForPlzList(
  customDistrictsByPlz: Record<string, string[]>,
  plzList: string[]
): string[] {
  const out = new Set<string>();
  for (const plz of plzList) {
    for (const district of customDistrictsByPlz[plz] ?? []) {
      out.add(district);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b, "de"));
}

function allDistrictsForPlz(
  customDistrictsByPlz: Record<string, string[]>,
  plz: string
): string[] {
  return customDistrictsByPlz[plz] ?? [];
}

function isPartialDistrictFilter(
  plz: string,
  catalogDistricts: string[],
  selectedForPlz: string[]
): boolean {
  if (selectedForPlz.length === 0) return false;

  const staticDistricts = staticDistrictsForPlz(plz);
  const staticSelected = selectedForPlz.filter((d) => staticDistricts.includes(d));
  if (
    staticDistricts.length > 0 &&
    staticSelected.length > 0 &&
    staticSelected.length < staticDistricts.length
  ) {
    return true;
  }

  const customOnly = catalogDistricts.filter((d) => !staticDistricts.includes(d));
  const customSelected = selectedForPlz.filter((d) => customOnly.includes(d));
  if (
    customOnly.length > 0 &&
    customSelected.length > 0 &&
    customSelected.length < customOnly.length
  ) {
    return true;
  }

  return false;
}

export function matchApartmentToAreaFilter(
  address: string | null | undefined,
  ortKey: string | null | undefined,
  config: AreaFilterConfig | null,
  customDistrictsByPlz: Record<string, string[]>
): AreaMatchResult {
  if (!isAreaFilterActive(ortKey, config) || !config) {
    return { status: "unset", plz: null, district: null };
  }

  const trimmed = String(address ?? "").trim();
  if (!trimmed) {
    return { status: "outside", plz: null, district: null };
  }

  const plz = extractGermanPlz(trimmed);
  if (!plz) {
    return { status: "outside", plz: null, district: null };
  }

  if (!config.selectedPlz.includes(plz)) {
    return { status: "outside", plz, district: null };
  }

  const catalogDistricts = allDistrictsForPlz(customDistrictsByPlz, plz);
  const selectedForPlz = config.selectedDistricts.filter((d) =>
    catalogDistricts.includes(d)
  );

  if (catalogDistricts.length === 0 || selectedForPlz.length === 0) {
    return { status: "inside", plz, district: null };
  }

  const district = extractDistrictFromAddress(trimmed, catalogDistricts);
  if (district) {
    if (selectedForPlz.includes(district)) {
      return { status: "inside", plz, district };
    }
    return { status: "outside", plz, district };
  }

  if (isPartialDistrictFilter(plz, catalogDistricts, selectedForPlz)) {
    return { status: "unknown", plz, district: null };
  }

  return { status: "inside", plz, district: null };
}

export function defaultDistrictsForPlzSelection(
  customDistrictsByPlz: Record<string, string[]>,
  selectedPlz: string[]
): string[] {
  return districtsForPlzList(customDistrictsByPlz, selectedPlz);
}

export function areaFilterLabel(status: AreaMatchStatus): string {
  switch (status) {
    case "inside":
      return "Im Wunschgebiet";
    case "outside":
      return "Außerhalb Wunschgebiet";
    case "unknown":
      return "Lage unklar";
    default:
      return "";
  }
}
