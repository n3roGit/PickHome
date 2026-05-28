import type { ApartmentLocationInsightsBundle } from "@/lib/location-insights";
import { formatAirQualityCompact } from "@/lib/air-quality-uba";
import { formatClimateCompact } from "@/lib/climate-open-meteo";
import {
  FLOOD_SCENARIO_LABELS,
  formatFloodCompact,
  type FloodScenarioId,
} from "@/lib/flood-bfg";
import { buildNoiseHumanSummary, formatNoiseMaxCompact } from "@/lib/noise-uba";
import { formatMicroLocationCompact } from "@/lib/overpass-micro";
import {
  formatPoiEnvironmentCompact,
  POI_CATEGORY_LABELS,
  type OverpassPoiData,
  type PoiCategoryId,
} from "@/lib/overpass-poi";
import { formatRadonCompact } from "@/lib/radon-bfs";

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
      "--- Umgebung (500m/1000m) ---",
      "Hinweis: öffentliche Kartendaten, keine Vollständigkeitsgarantie.",
      ...lines
    );
  }

  if (bundle.noise.status === "ok") {
    const hits = bundle.noise.data?.hits ?? [];
    const summary = buildNoiseHumanSummary(hits);
    const noiseLines =
      summary.sources.length > 0
        ? [
            `- ${summary.headline}`,
            ...summary.sources.flatMap((src) =>
              src.lines.map(
                (line) =>
                  `- ${src.sourceLabel}, ${line.metricLabel}: ${line.bandHuman} (${line.assessment})`
              )
            ),
          ]
        : ["- Kein Treffer in der UBA-Karte"];
    blocks.push(
      "",
      "--- Lärm (UBA, EU-Umgebungslärmrichtlinie) ---",
      "Hinweis: nur Hauptverkehrswege/Ballungsräume kartiert; kein Treffer ≠ leise.",
      ...noiseLines
    );
  }

  if (bundle.air.status === "ok" && bundle.air.data) {
    const d = bundle.air.data;
    blocks.push(
      "",
      "--- Luftqualität (UBA Messstationen) ---",
      `Hinweis: nächste Station „${d.stationName}“ (${d.distanceM} m), keine Messung an der Adresse.`,
      `- ${d.headline}`,
      ...d.measurements.map(
        (m) => `- ${m.label}: Index ${m.valueDisplay} (${m.assessment})`
      )
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

  if (bundle.radon.status === "ok" && bundle.radon.data) {
    const d = bundle.radon.data;
    blocks.push(
      "",
      "--- Radon (BfS, Gemeinde-Prognose) ---",
      "Hinweis: Prognose auf Gemeindeebene — Einzelgebäude nur durch Messung.",
      `- ${d.headline}`,
      `- Gemeinde: ${d.municipalityName}${d.municipalityType ? ` (${d.municipalityType})` : ""}`,
      ...(d.indoorRadonBqPerM3 != null
        ? [`- Durchschnitt Wohnungen: ${d.indoorRadonBqPerM3} Bq/m³`]
        : []),
      ...(d.soilPotentialPercent != null
        ? [`- Boden-Radonpotenzial: ${d.soilPotentialPercent} %`]
        : []),
      ...(d.precautionAreas.length > 0
        ? d.precautionAreas.map((a) => `- Vorsorgegebiet: ${a.name}`)
        : []),
      `- ${d.assessment}`
    );
  }

  if (bundle.micro.status === "ok" && bundle.micro.data) {
    const m = bundle.micro.data;
    blocks.push(
      "",
      "--- Mikrolage (OSM) ---",
      "Hinweis: Kartendaten, keine Vollständigkeitsgarantie.",
      `- Gebäude: ${m.buildingHeadline}`,
      `- Gewerbe: ${m.industrialHeadline}`,
      `- Verkehr: ${m.transportHeadline}`,
      `- Nachtleben: ${m.nightlifeHeadline}`
    );
  }

  if (bundle.climate.status === "ok" && bundle.climate.data) {
    const c = bundle.climate.data;
    blocks.push(
      "",
      "--- Klima (${c.periodLabel}, Open-Meteo) ---",
      "Hinweis: Modellwerte am Standort — Orientierung für Heizung und Feuchte.",
      `- ${c.headline}`,
      ...(c.meanSummerMaxTempC != null
        ? [`- Sommer Ø Tageshöchstwert: ${c.meanSummerMaxTempC} °C`]
        : []),
      ...(c.meanWinterMaxTempC != null
        ? [`- Winter Ø Tageshöchstwert: ${c.meanWinterMaxTempC} °C`]
        : []),
      ...(c.meanRainyDaysPerYear != null
        ? [`- Regentage/Jahr: ${c.meanRainyDaysPerYear}`]
        : []),
      `- ${c.assessment}`
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
  air: ApartmentPdfLocationRow[];
  radon: ApartmentPdfLocationRow[];
  micro: ApartmentPdfLocationRow[];
  climate: ApartmentPdfLocationRow[];
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
    const summary = buildNoiseHumanSummary(hits);
    if (summary.sources.length === 0) {
      noise.push({
        label: "UBA",
        value: "Kein Treffer (nur Hauptverkehr/Ballungsraum kartiert)",
      });
    } else {
      noise.push({ label: "Einschätzung", value: summary.headline });
      for (const src of summary.sources) {
        for (const line of src.lines) {
          noise.push({
            label: src.sourceLabel,
            value: `${line.metricLabel}: ${line.bandHuman}`,
          });
        }
      }
    }
  }

  const air: ApartmentPdfLocationRow[] = [];
  if (bundle.air.status === "ok" && bundle.air.data) {
    const d = bundle.air.data;
    air.push({
      label: "Messstation",
      value: `${d.stationName} (${d.distanceM} m)`,
    });
    for (const m of d.measurements) {
      air.push({
        label: m.label,
        value: `Index ${m.valueDisplay} (${m.assessment})`,
      });
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

  const radon: ApartmentPdfLocationRow[] = [];
  if (bundle.radon.status === "ok" && bundle.radon.data) {
    const d = bundle.radon.data;
    radon.push({ label: "Einschätzung", value: d.headline });
    if (d.indoorRadonBqPerM3 != null) {
      radon.push({
        label: "Gemeinde Ø Wohnungen",
        value: `${d.indoorRadonBqPerM3} Bq/m³ (${d.municipalityName})`,
      });
    }
    if (d.soilPotentialPercent != null) {
      radon.push({
        label: "Bodenpotenzial",
        value: `${d.soilPotentialPercent} %`,
      });
    }
    for (const area of d.precautionAreas) {
      radon.push({ label: "Vorsorgegebiet", value: area.name });
    }
  }

  const micro: ApartmentPdfLocationRow[] = [];
  if (bundle.micro.status === "ok" && bundle.micro.data) {
    const m = bundle.micro.data;
    micro.push({ label: "Gebäude", value: m.buildingHeadline });
    micro.push({ label: "Gewerbe", value: m.industrialHeadline });
    micro.push({ label: "Verkehr", value: m.transportHeadline });
    micro.push({ label: "Nachtleben", value: m.nightlifeHeadline });
  }

  const climate: ApartmentPdfLocationRow[] = [];
  if (bundle.climate.status === "ok" && bundle.climate.data) {
    const c = bundle.climate.data;
    climate.push({ label: "Zeitraum", value: c.periodLabel });
    climate.push({ label: "Überblick", value: c.headline });
    if (c.meanSummerMaxTempC != null) {
      climate.push({ label: "Sommer Ø max.", value: `${c.meanSummerMaxTempC} °C` });
    }
    if (c.meanWinterMaxTempC != null) {
      climate.push({ label: "Winter Ø max.", value: `${c.meanWinterMaxTempC} °C` });
    }
    if (c.meanRainyDaysPerYear != null) {
      climate.push({ label: "Regentage/Jahr", value: String(c.meanRainyDaysPerYear) });
    }
  }

  return { environment, noise, flood, air, radon, micro, climate };
}

export function locationInsightCompareStrings(bundle: ApartmentLocationInsightsBundle): {
  environment: string;
  noise: string;
  flood: string;
  air: string;
  radon: string;
  micro: string;
  climate: string;
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
    air:
      bundle.air.status === "ok" && bundle.air.data
        ? formatAirQualityCompact(bundle.air.data)
        : "—",
    radon:
      bundle.radon.status === "ok" && bundle.radon.data
        ? formatRadonCompact(bundle.radon.data)
        : "—",
    micro:
      bundle.micro.status === "ok" && bundle.micro.data
        ? formatMicroLocationCompact(bundle.micro.data)
        : "—",
    climate:
      bundle.climate.status === "ok" && bundle.climate.data
        ? formatClimateCompact(bundle.climate.data)
        : "—",
  };
}
