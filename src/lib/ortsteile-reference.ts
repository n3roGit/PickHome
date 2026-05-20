import ortsteileDe from "@/data/ortsteile-de.json";

export type OrtsteileReferenceData = {
  source: string;
  generatedAt: string;
  plzWithDistricts: number;
  byPlz: Record<string, string[]>;
};

const data = ortsteileDe as OrtsteileReferenceData;

export function getOrtsteileReferenceData(): OrtsteileReferenceData {
  return data;
}

export function staticDistrictsForPlz(plz: string): string[] {
  return data.byPlz[plz] ?? [];
}

export function mergeDistrictsByPlz(
  projectCustom: Record<string, string[]>
): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...data.byPlz };

  for (const [plz, names] of Object.entries(projectCustom)) {
    const combined = new Set([...(merged[plz] ?? []), ...names]);
    merged[plz] = [...combined].sort((a, b) => a.localeCompare(b, "de"));
  }

  return merged;
}

export function hasStaticDistrictsForPlz(plz: string): boolean {
  return (data.byPlz[plz]?.length ?? 0) > 0;
}
