import plzDe from "@/data/plz-de.json";

export type PlzReferenceOrt = {
  name: string;
  bundesland: string;
  plz: string[];
};

export type PlzReferenceEntry = {
  plz: string;
  bundesland: string;
  orte: string[];
  lat?: number;
  lng?: number;
};

export type PlzReferenceData = {
  source: string;
  generatedAt: string;
  ortCount: number;
  plzCount: number;
  bundeslaender: string[];
  orte: PlzReferenceOrt[];
  plz: PlzReferenceEntry[];
};

const data = plzDe as PlzReferenceData;

export function getPlzReferenceData(): PlzReferenceData {
  return data;
}

export function ortReferenceKey(name: string, bundesland: string): string {
  return `${name.trim()}|${bundesland.trim()}`;
}

export function parseOrtReferenceKey(key: string): { name: string; bundesland: string } | null {
  const idx = key.lastIndexOf("|");
  if (idx <= 0) return null;
  const name = key.slice(0, idx).trim();
  const bundesland = key.slice(idx + 1).trim();
  if (!name || !bundesland) return null;
  return { name, bundesland };
}

export function findOrtByKey(key: string): PlzReferenceOrt | null {
  const parsed = parseOrtReferenceKey(key);
  if (!parsed) return null;
  return (
    data.orte.find(
      (o) => o.name === parsed.name && o.bundesland === parsed.bundesland
    ) ?? null
  );
}

export function searchOrte(query: string, bundesland?: string, limit = 40): PlzReferenceOrt[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const matches = data.orte.filter((o) => {
    if (bundesland && o.bundesland !== bundesland) return false;
    return o.name.toLowerCase().includes(q);
  });

  matches.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name, "de");
  });

  return matches.slice(0, limit);
}

export function plzEntry(plz: string): PlzReferenceEntry | null {
  return data.plz.find((e) => e.plz === plz) ?? null;
}

export function plzCentroid(plz: string): { lat: number; lng: number } | null {
  const entry = plzEntry(plz);
  if (entry?.lat == null || entry?.lng == null) return null;
  return { lat: entry.lat, lng: entry.lng };
}

export function formatOrtLabel(ort: Pick<PlzReferenceOrt, "name" | "bundesland">): string {
  return `${ort.name} (${ort.bundesland})`;
}
