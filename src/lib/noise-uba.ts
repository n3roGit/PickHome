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

export type NoiseAssessmentLevel = "quiet" | "moderate" | "loud" | "very_loud";

export type NoiseHumanSourceLine = {
  metricLabel: string;
  bandHuman: string;
  assessment: string;
};

export type NoiseHumanSourceSummary = {
  source: NoiseSource;
  sourceLabel: string;
  lines: NoiseHumanSourceLine[];
};

export type NoiseHumanSummary = {
  headline: string;
  overallLevel: NoiseAssessmentLevel | "none";
  sources: NoiseHumanSourceSummary[];
};

const SKIP_LAYER_PREFIXES = ["Bundeslaender_", "Ballungsraeume_"];

const SOURCE_LABELS: Record<Exclude<NoiseSource, "Sonstige" | "Ballungsraum">, string> = {
  Straße: "Straßenverkehr",
  Schiene: "Schienenverkehr",
  Flughafen: "Fluglärm",
};

const METRIC_LABELS: Record<"Lden" | "Lnight", string> = {
  Lden: "Tageslärm (Durchschnitt Tag/Abend/Nacht)",
  Lnight: "Nachtlärm (22–6 Uhr)",
};

const ASSESSMENT_LABELS: Record<NoiseAssessmentLevel, string> = {
  quiet: "eher ruhig",
  moderate: "mäßig laut (typisch städtisch)",
  loud: "laut",
  very_loud: "sehr laut",
};

const BLR_NOISE_FIELDS: { key: string; source: NoiseSource }[] = [
  { key: "road_den", source: "Straße" },
  { key: "road_night", source: "Straße" },
  { key: "rail_den", source: "Schiene" },
  { key: "rail_night", source: "Schiene" },
  { key: "air_den", source: "Flughafen" },
  { key: "air_night", source: "Flughafen" },
];

function classifySource(layerName: string): NoiseSource {
  const n = layerName.toLowerCase();
  if (n.includes("flughaf") || n.includes("airport") || n.includes("flug") || n.includes("_air")) {
    return "Flughafen";
  }
  if (n.includes("schiene") || n.includes("bahn") || n.includes("rail")) return "Schiene";
  if (n.includes("straße") || n.includes("strasse") || n.includes("road") || n.includes("verkehr")) {
    return "Straße";
  }
  if (n.includes("ballung") || n.includes("agglomer")) return "Ballungsraum";
  return "Sonstige";
}

/** UBA codes like Lden6064 → 60–64 dB, Lden75 → >75 dB. */
export function parseUbaNoiseCode(raw: string): { metric: NoiseMetric; bandDb: string } | null {
  const text = raw.trim();
  if (!text) return null;

  const range = text.match(/^L(den|night)(\d{2})(\d{2})$/i);
  if (range) {
    return {
      metric: range[1].toLowerCase() === "night" ? "Lnight" : "Lden",
      bandDb: `${range[2]}-${range[3]}`,
    };
  }

  const gt = text.match(/^L(den|night)(\d{2})$/i);
  if (gt) {
    return {
      metric: gt[1].toLowerCase() === "night" ? "Lnight" : "Lden",
      bandDb: `>${gt[2]}`,
    };
  }

  const looseRange = text.match(/(\d{2})\s*[-–]\s*(\d{2})/);
  if (looseRange) {
    const metric: NoiseMetric = text.toLowerCase().includes("night") ? "Lnight" : "Lden";
    return { metric, bandDb: `${looseRange[1]}-${looseRange[2]}` };
  }

  const looseGt = text.match(/>\s*(\d{2})/);
  if (looseGt) {
    const metric: NoiseMetric = text.toLowerCase().includes("night") ? "Lnight" : "Lden";
    return { metric, bandDb: `>${looseGt[1]}` };
  }

  return null;
}

function shouldSkipLayer(layerName: string): boolean {
  return SKIP_LAYER_PREFIXES.some((p) => layerName.startsWith(p));
}

function pushHit(
  results: NoiseHit[],
  source: NoiseSource,
  metric: NoiseMetric,
  bandDb: string,
  layerName: string
): void {
  if (metric === "unknown" || !isMeaningfulBand(bandDb)) return;
  results.push({ source, metric, bandDb, layerName });
}

function parseHitsFromAttributes(
  attrs: Record<string, unknown>,
  layerName: string,
  results: NoiseHit[]
): void {
  const klasse = attrString(attrs, "Lärmpegelklasse", "Laermpegelklasse");
  if (klasse) {
    const parsed = parseUbaNoiseCode(klasse);
    if (parsed) {
      pushHit(results, classifySource(layerName), parsed.metric, parsed.bandDb, layerName);
    }
  }

  for (const { key, source } of BLR_NOISE_FIELDS) {
    const raw = attrs[key];
    if (raw == null || String(raw).trim() === "") continue;
    const parsed = parseUbaNoiseCode(String(raw));
    if (parsed) {
      pushHit(results, source, parsed.metric, parsed.bandDb, layerName);
    }
  }

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    const keyLower = key.toLowerCase();
    if (!keyLower.includes("lden") && !keyLower.includes("lnight")) continue;
    if (typeof value === "number" && value > 200) continue;
    const parsed = parseUbaNoiseCode(String(value));
    if (parsed) {
      pushHit(results, classifySource(layerName), parsed.metric, parsed.bandDb, layerName);
    }
  }
}

export function dedupeNoiseHits(hits: NoiseHit[]): NoiseHit[] {
  const map = new Map<string, NoiseHit>();
  for (const hit of hits) {
    const key = `${hit.source}:${hit.metric}`;
    const existing = map.get(key);
    const hitDb = noiseBandLowerDb(hit.bandDb) ?? -1;
    const existingDb = existing ? (noiseBandLowerDb(existing.bandDb) ?? -1) : -1;
    if (!existing || hitDb > existingDb) {
      map.set(key, hit);
    }
  }
  return [...map.values()];
}

export function parseNoiseIdentifyResults(
  hits: { layerName?: string; attributes?: Record<string, unknown> }[]
): NoiseHit[] {
  const results: NoiseHit[] = [];
  for (const hit of hits) {
    const layerName = hit.layerName?.trim();
    const attrs = hit.attributes;
    if (!layerName || !attrs || shouldSkipLayer(layerName)) continue;
    parseHitsFromAttributes(attrs, layerName, results);
  }
  return dedupeNoiseHits(results);
}

export function isMeaningfulBand(bandDb: string): boolean {
  return noiseBandLowerDb(bandDb) != null;
}

/** Parse dB lower bound from band string for sorting/warnings. */
export function noiseBandLowerDb(bandDb: string): number | null {
  const gt = bandDb.match(/^>\s*(\d+)/);
  if (gt) return parseInt(gt[1], 10);
  const range = bandDb.match(/^(\d+)/);
  if (range) return parseInt(range[1], 10);
  return null;
}

export function noiseBandAssessment(bandDb: string): NoiseAssessmentLevel {
  const lower = noiseBandLowerDb(bandDb);
  if (lower == null) return "moderate";
  if (lower >= 70) return "very_loud";
  if (lower >= 65) return "loud";
  if (lower >= 55) return "moderate";
  return "quiet";
}

export function formatBandDbHuman(bandDb: string): string {
  if (bandDb.startsWith(">")) {
    return `über ${bandDb.slice(1).trim()} dB`;
  }
  if (bandDb.includes("-")) {
    return `ca. ${bandDb.replace("-", "–")} dB`;
  }
  return `ca. ${bandDb} dB`;
}

export function buildNoiseHumanSummary(hits: NoiseHit[]): NoiseHumanSummary {
  const displayHits = hits.filter(
    (h) => h.source !== "Sonstige" && h.source !== "Ballungsraum"
  );
  if (displayHits.length === 0) {
    return {
      headline: "Kein relevanter Lärmeintrag in der UBA-Karte an diesem Punkt.",
      overallLevel: "none",
      sources: [],
    };
  }

  const worstHit = displayHits.reduce((best, hit) => {
    const hitDb = noiseBandLowerDb(hit.bandDb) ?? -1;
    const bestDb = noiseBandLowerDb(best.bandDb) ?? -1;
    return hitDb > bestDb ? hit : best;
  });
  const overallLevel = noiseBandAssessment(worstHit.bandDb);

  let headline: string;
  switch (overallLevel) {
    case "very_loud":
      headline =
        "Die UBA-Lärmkarte zeigt hier eine hohe Belastung durch Hauptverkehrswege (ab ca. 70 dB).";
      break;
    case "loud":
      headline =
        "Die UBA-Lärmkarte zeigt hier spürbaren Lärm von Hauptstraßen oder Schienen (ca. 65–70 dB).";
      break;
    case "moderate":
      headline =
        "Die UBA-Lärmkarte ordnet den Standort dem städtischen Mittelbereich zu (ca. 55–65 dB).";
      break;
    case "quiet":
      headline =
        "Die UBA-Lärmkarte zeigt hier eher niedrigere Pegel — trotzdem nur grobe Orientierung.";
      break;
    default:
      headline = "";
  }

  const sourceOrder = ["Straße", "Schiene", "Flughafen"] as const;
  const sources: NoiseHumanSourceSummary[] = [];

  for (const source of sourceOrder) {
    const sourceHits = displayHits.filter((h) => h.source === source);
    if (sourceHits.length === 0) continue;

    const lines: NoiseHumanSourceLine[] = [];
    for (const metric of ["Lden", "Lnight"] as const) {
      const hit = sourceHits.find((h) => h.metric === metric);
      if (!hit) continue;
      lines.push({
        metricLabel: METRIC_LABELS[metric],
        bandHuman: formatBandDbHuman(hit.bandDb),
        assessment: ASSESSMENT_LABELS[noiseBandAssessment(hit.bandDb)],
      });
    }

    if (lines.length > 0) {
      sources.push({
        source,
        sourceLabel: SOURCE_LABELS[source],
        lines,
      });
    }
  }

  return { headline, overallLevel, sources };
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
  const metric =
    hit.metric === "Lden" || hit.metric === "Lnight" ? METRIC_LABELS[hit.metric] : "Lärm";
  const source =
    hit.source in SOURCE_LABELS
      ? SOURCE_LABELS[hit.source as keyof typeof SOURCE_LABELS]
      : hit.source;
  return `${source}, ${metric}: ${formatBandDbHuman(hit.bandDb)} (${ASSESSMENT_LABELS[noiseBandAssessment(hit.bandDb)]})`;
}

export function formatNoiseMaxCompact(hits: NoiseHit[] | null): string {
  if (!hits?.length) return "kein Treffer";
  const summary = buildNoiseHumanSummary(hits);
  if (summary.sources.length === 0) return "kein Treffer";
  const top = summary.sources[0];
  const line = top.lines[0];
  return `${top.sourceLabel}: ${line.bandHuman}`;
}

export async function fetchNoiseUbaForCoords(
  latitude: number,
  longitude: number,
  options?: { background?: boolean }
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
    fetchOptions: options?.background ? { background: true } : undefined,
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
