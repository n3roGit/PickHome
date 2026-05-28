import { attrString, fetchArcGisIdentify } from "@/lib/arcgis-identify";

export const BFG_FLOOD_MAP_SERVER_URL =
  process.env.FLOOD_MAP_URL?.trim() ||
  "https://geoportal.bafg.de/arcgis1/rest/services/INSPIRE/NZ/MapServer";

export const BFG_FLOOD_SOURCE_URL =
  "https://www.govdata.de/web/guest/suchen/-/details/uberflutungsrisikozonen-de-hochwasserrisikomanagement-rl-3-zyklus-2022-202793828";

export type FloodScenarioId = "HQhaeufig" | "HQ100" | "HQextrem";

export type FloodScenarioStatus = "betroffen" | "nicht_betroffen";

export type FloodBfgData = {
  scenarios: Record<FloodScenarioId, FloodScenarioStatus>;
  detailLines: string[];
};

const SCENARIO_ORDER: FloodScenarioId[] = ["HQhaeufig", "HQ100", "HQextrem"];

function classifyScenario(layerName: string, attrs: Record<string, unknown>): FloodScenarioId | null {
  const blob = `${layerName} ${JSON.stringify(attrs)}`.toLowerCase();
  if (
    blob.includes("hqext") ||
    blob.includes("extrem") ||
    blob.includes("hq_ext") ||
    blob.includes("niedrig")
  ) {
    return "HQextrem";
  }
  if (blob.includes("hq100") || blob.includes("100") || blob.includes("mittel")) {
    return "HQ100";
  }
  if (
    blob.includes("hq10") ||
    blob.includes("häufig") ||
    blob.includes("haeufig") ||
    blob.includes("hoch") ||
    blob.includes("frequent")
  ) {
    return "HQhaeufig";
  }
  return null;
}

function isAffected(attrs: Record<string, unknown>, layerName: string): boolean {
  const zone = attrString(attrs, "zone", "ZONE", "type", "TYPE", "hazard", "HAZARD");
  const name = layerName.toLowerCase();
  if (name.includes("risiko") || name.includes("risk") || name.includes("zone")) {
    return true;
  }
  if (zone) {
    const z = zone.toLowerCase();
    if (z.includes("none") || z.includes("kein")) return false;
    return true;
  }
  return true;
}

export function parseFloodIdentifyResults(
  hits: { layerName?: string; attributes?: Record<string, unknown> }[]
): FloodBfgData {
  const scenarios: Record<FloodScenarioId, FloodScenarioStatus> = {
    HQhaeufig: "nicht_betroffen",
    HQ100: "nicht_betroffen",
    HQextrem: "nicht_betroffen",
  };
  const detailLines: string[] = [];

  for (const hit of hits) {
    const layerName = hit.layerName?.trim() ?? "";
    const attrs = hit.attributes ?? {};
    if (!layerName || !isAffected(attrs, layerName)) continue;

    const scenario = classifyScenario(layerName, attrs);
    if (scenario) {
      scenarios[scenario] = "betroffen";
    }
    const label = attrString(attrs, "name", "NAME", "Label", "description", "DESCRIPTION");
    if (label) detailLines.push(`${layerName}: ${label}`);
  }

  return { scenarios, detailLines: [...new Set(detailLines)].slice(0, 5) };
}

export function worstFloodScenario(
  data: FloodBfgData | null
): FloodScenarioId | null {
  if (!data) return null;
  if (data.scenarios.HQ100 === "betroffen") return "HQ100";
  if (data.scenarios.HQextrem === "betroffen") return "HQextrem";
  if (data.scenarios.HQhaeufig === "betroffen") return "HQhaeufig";
  return null;
}

export const FLOOD_SCENARIO_LABELS: Record<FloodScenarioId, string> = {
  HQhaeufig: "Häufig (HQ hoch)",
  HQ100: "HQ100",
  HQextrem: "Extrem / selten",
};

export function formatFloodCompact(data: FloodBfgData | null): string {
  if (!data) return "—";
  const worst = worstFloodScenario(data);
  if (!worst) return "kein Risiko";
  return FLOOD_SCENARIO_LABELS[worst];
}

export async function fetchFloodBfgForCoords(
  latitude: number,
  longitude: number
): Promise<
  | { ok: true; data: FloodBfgData; noData?: boolean }
  | { ok: false; error: string }
> {
  const identified = await fetchArcGisIdentify({
    mapServerUrl: BFG_FLOOD_MAP_SERVER_URL,
    latitude,
    longitude,
    service: "flood",
    sr: "4326",
    tolerance: 12,
  });

  if (!identified.ok) {
    return { ok: false, error: identified.error };
  }

  const data = parseFloodIdentifyResults(identified.results);
  const affected = SCENARIO_ORDER.some((s) => data.scenarios[s] === "betroffen");
  return {
    ok: true,
    data,
    noData: !affected && identified.results.length === 0,
  };
}
