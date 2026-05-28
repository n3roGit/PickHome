import { attrString, fetchArcGisIdentify } from "@/lib/arcgis-identify";

export const UBA_NOISE_MAP_SERVER_URL =
  process.env.NOISE_MAP_URL?.trim() ||
  "https://datahub.uba.de/server/rest/services/VeLa/LK/MapServer";

export const UBA_NOISE_SOURCE_URL =
  "https://www.umweltbundesamt.de/themen/laerm/laermkartierung";

export type NoiseSource = "Straße" | "Schiene" | "Flughafen" | "Ballungsraum" | "Sonstige";

export type NoiseMetric = "Lden" | "Lnight" | "unknown";

export type NoiseHit = {
  source: NoiseSource;
  metric: NoiseMetric;
  bandDb: string;
  layerName: string;
};

export type NoiseUbaData = {
  hits: NoiseHit[];
};

function classifySource(layerName: string): NoiseSource {
  const n = layerName.toLowerCase();
  if (n.includes("flughaf") || n.includes("airport") || n.includes("flug")) return "Flughafen";
  if (n.includes("schiene") || n.includes("bahn") || n.includes("rail")) return "Schiene";
  if (n.includes("straße") || n.includes("strasse") || n.includes("road") || n.includes("verkehr")) {
    return "Straße";
  }
  if (n.includes("ballung") || n.includes("agglomer")) return "Ballungsraum";
  return "Sonstige";
}

function classifyMetric(layerName: string, attrs: Record<string, unknown>): NoiseMetric {
  const blob = `${layerName} ${JSON.stringify(attrs)}`.toLowerCase();
  if (blob.includes("lnight") || blob.includes("l_night") || blob.includes("nacht")) {
    return "Lnight";
  }
  if (blob.includes("lden") || blob.includes("l_den") || blob.includes("tag")) {
    return "Lden";
  }
  return "unknown";
}

function parseNoiseBand(attrs: Record<string, unknown>, layerName: string): string {
  const keys = [
    "Lden",
    "LDEN",
    "L_night",
    "LNIGHT",
    "Lnight",
    "db",
    "DB",
    "LAERM",
    "Lärm",
    "PEGEL",
    "pegel",
    "WERT",
    "wert",
    "KLASSE",
    "klasse",
    "Label",
    "label",
    "Value",
    "value",
  ];
  for (const key of keys) {
    const v = attrs[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  const display = attrString(attrs, "Display", "NAME", "Name", "Beschreibung");
  if (display) return display;
  return layerName;
}

function normalizeBandDb(raw: string): string {
  const text = raw.trim();
  const range = text.match(/(\d{2})\s*[-–]\s*(\d{2})/);
  if (range) return `${range[1]}-${range[2]}`;
  const gt = text.match(/>\s*(\d{2})/);
  if (gt) return `>${gt[1]}`;
  const single = text.match(/\b(\d{2})\b/);
  if (single) return single[1];
  return text.slice(0, 40);
}

export function parseNoiseIdentifyResults(
  hits: { layerName?: string; attributes?: Record<string, unknown> }[]
): NoiseHit[] {
  const results: NoiseHit[] = [];
  for (const hit of hits) {
    const layerName = hit.layerName?.trim();
    const attrs = hit.attributes;
    if (!layerName || !attrs) continue;
    const bandRaw = parseNoiseBand(attrs, layerName);
    if (!bandRaw) continue;
    results.push({
      source: classifySource(layerName),
      metric: classifyMetric(layerName, attrs),
      bandDb: normalizeBandDb(bandRaw),
      layerName,
    });
  }
  return results;
}

/** Parse dB lower bound from band string for sorting/warnings. */
export function noiseBandLowerDb(bandDb: string): number | null {
  const gt = bandDb.match(/^>\s*(\d+)/);
  if (gt) return parseInt(gt[1], 10);
  const range = bandDb.match(/^(\d+)/);
  if (range) return parseInt(range[1], 10);
  return null;
}

export function highestNoiseBandDb(hits: NoiseHit[]): number | null {
  let max: number | null = null;
  for (const hit of hits) {
    const v = noiseBandLowerDb(hit.bandDb);
    if (v != null && (max == null || v > max)) max = v;
  }
  return max;
}

export function noiseHitsForCriterionName(hits: NoiseHit[], criterionName: string): NoiseHit[] {
  const n = criterionName.toLowerCase();
  return hits.filter((hit) => {
    if (hit.source === "Flughafen" && n.includes("flug")) return true;
    if (
      hit.source === "Schiene" &&
      (n.includes("zug") || n.includes("bahn") || n.includes("schiene"))
    ) {
      return true;
    }
    if (
      hit.source === "Straße" &&
      (n.includes("straße") || n.includes("strasse") || n.includes("verkehr"))
    ) {
      return true;
    }
    return false;
  });
}

export function formatNoiseHitLine(hit: NoiseHit): string {
  const metric = hit.metric === "unknown" ? "" : ` ${hit.metric}`;
  return `${hit.source}${metric}: ${hit.bandDb} dB(A)`;
}

export function formatNoiseMaxCompact(hits: NoiseHit[] | null): string {
  if (!hits?.length) return "kein Treffer";
  const maxDb = highestNoiseBandDb(hits);
  const top = hits.find((h) => noiseBandLowerDb(h.bandDb) === maxDb) ?? hits[0];
  return formatNoiseHitLine(top);
}

export async function fetchNoiseUbaForCoords(
  latitude: number,
  longitude: number
): Promise<
  | { ok: true; data: NoiseUbaData; noData?: boolean }
  | { ok: false; error: string }
> {
  const identified = await fetchArcGisIdentify({
    mapServerUrl: UBA_NOISE_MAP_SERVER_URL,
    latitude,
    longitude,
    service: "noise",
    sr: "4326",
  });

  if (!identified.ok) {
    return { ok: false, error: identified.error };
  }

  const hits = parseNoiseIdentifyResults(identified.results);
  return {
    ok: true,
    data: { hits },
    noData: hits.length === 0,
  };
}
