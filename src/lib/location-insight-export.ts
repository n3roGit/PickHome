import type { ApartmentLocationInsightsBundle } from "@/lib/location-insights";
import {
  FLOOD_SCENARIO_LABELS,
  formatFloodCompact,
  type FloodScenarioId,
} from "@/lib/flood-bfg";
import { formatNoiseHitLine, formatNoiseMaxCompact } from "@/lib/noise-uba";
import {
  formatPoiEnvironmentCompact,
  POI_CATEGORY_LABELS,
  type OverpassPoiData,
  type PoiCategoryId,
} from "@/lib/overpass-poi";

const POI_ORDER: PoiCategoryId[] = [
  "supermarket",
  "pharmacy",
  "school",
  "kindergarten",
  "publicTransport",
  "park",
  "medical",
];

export function buildLocationInsightLlmBlocks(
  bundle: ApartmentLocationInsightsBundle
): string[] {
  const blocks: string[] = [];

  if (bundle.overpass.status === "ok" && bundle.overpass.data) {
    const lines = POI_ORDER.flatMap((id) => {
      const cat = bundle.overpass.data!.categories[id];
      const nearest = cat.nearest;
      const nearestLabel = nearest
        ? `${nearest.name ?? "Unbenannt"} (${nearest.distanceM} m)`
        : "—";
      return [
        `- ${POI_CATEGORY_LABELS[id]}: ${cat.countClose} (500 m), ${cat.countWide} (1 km); nächste: ${nearestLabel}`,
      ];
    });
    blocks.push(
      "",
      "--- Umgebung (OpenStreetMap, 500m/1000m) ---",
      "Hinweis: OSM-Daten, keine Vollständigkeitsgarantie.",
      ...lines
    );
  }

  if (bundle.noise.status === "ok") {
    const hits = bundle.noise.data?.hits ?? [];
    blocks.push(
      "",
      "--- Lärm (UBA, EU-Umgebungslärmrichtlinie) ---",
      "Hinweis: nur Hauptverkehrswege/Ballungsräume kartiert; kein Treffer ≠ leise.",
      ...(hits.length > 0
        ? hits.map((h) => `- ${formatNoiseHitLine(h)}`)
        : ["- Kein Treffer in der UBA-Karte"])
    );
  }

  if (bundle.flood.status === "ok" && bundle.flood.data) {
    const s = bundle.flood.data.scenarios;
    blocks.push(
      "",
      "--- Hochwasser (BfG, HWRM-RL 3. Zyklus) ---",
      "Hinweis: nur Flusshochwasser, kein Starkregen.",
      `- ${FLOOD_SCENARIO_LABELS.HQhaeufig}: ${s.HQhaeufig}`,
      `- ${FLOOD_SCENARIO_LABELS.HQ100}: ${s.HQ100}`,
      `- ${FLOOD_SCENARIO_LABELS.HQextrem}: ${s.HQextrem}`
    );
  }

  return blocks;
}

export type ApartmentPdfLocationRow = { label: string; value: string };

export function buildLocationInsightPdfRows(
  bundle: ApartmentLocationInsightsBundle
): {
  environment: ApartmentPdfLocationRow[];
  noise: ApartmentPdfLocationRow[];
  flood: ApartmentPdfLocationRow[];
} {
  const environment: ApartmentPdfLocationRow[] = [];
  if (bundle.overpass.status === "ok" && bundle.overpass.data) {
    for (const id of POI_ORDER) {
      const cat = bundle.overpass.data.categories[id];
      const nearest = cat.nearest;
      environment.push({
        label: POI_CATEGORY_LABELS[id],
        value: `${cat.countWide} im Umkreis 1 km${
          nearest
            ? ` · nächste: ${nearest.name ?? "—"} (${nearest.distanceM} m)`
            : ""
        }`,
      });
    }
  }

  const noise: ApartmentPdfLocationRow[] = [];
  if (bundle.noise.status === "ok") {
    const hits = bundle.noise.data?.hits ?? [];
    if (hits.length === 0) {
      noise.push({
        label: "UBA",
        value: "Kein Treffer (nur Hauptverkehr/Ballungsraum kartiert)",
      });
    } else {
      for (const hit of hits) {
        noise.push({ label: hit.source, value: formatNoiseHitLine(hit) });
      }
    }
  }

  const flood: ApartmentPdfLocationRow[] = [];
  if (bundle.flood.status === "ok" && bundle.flood.data) {
    for (const id of ["HQhaeufig", "HQ100", "HQextrem"] as FloodScenarioId[]) {
      flood.push({
        label: FLOOD_SCENARIO_LABELS[id],
        value:
          bundle.flood.data.scenarios[id] === "betroffen"
            ? "betroffen"
            : "nicht betroffen",
      });
    }
  }

  return { environment, noise, flood };
}

export function locationInsightCompareStrings(bundle: ApartmentLocationInsightsBundle): {
  environment: string;
  noise: string;
  flood: string;
} {
  return {
    environment:
      bundle.overpass.status === "ok" && bundle.overpass.data
        ? formatPoiEnvironmentCompact(bundle.overpass.data)
        : "—",
    noise:
      bundle.noise.status === "ok"
        ? formatNoiseMaxCompact(bundle.noise.data?.hits ?? null)
        : "—",
    flood:
      bundle.flood.status === "ok" && bundle.flood.data
        ? formatFloodCompact(bundle.flood.data)
        : "—",
  };
}
