import {
  attrString,
  fetchArcGisIdentify,
  type ArcGisIdentifyHit,
} from "@/lib/arcgis-identify";

export const BORIS_MAP_SERVER_URL =
  "https://www.gis.nrw.de/arcgis/rest/services/immobilien/boris_de_bodenrichtwerte_current/MapServer";

export const BORIS_PORTAL_REFERER = "https://www.bodenrichtwerte-boris.de/boris-d/";

export type BorisResult = {
  kategorie: string;
  kategorieLabel: string;
  brwEurPerSqm: number;
  nutzungsart: string | null;
  nutzungsartLabel: string | null;
  erganzungNutzung: string | null;
  erganzungLabel: string | null;
  zoneNumber: string | null;
  zoneName: string | null;
  gemeinde: string | null;
  gemarkung: string | null;
  stichtag: string | null;
  entwicklungszustand: string | null;
  beitragsrecht: string | null;
};

export type BorisFetchOutcome =
  | { ok: true; results: BorisResult[] }
  | { ok: false; error: string };

const LAYER_LABELS: Record<string, string> = {
  brw_wohnbauflaeche: "Wohnbaufläche",
  brw_gemischte_bauweise: "Gemischte Baufläche",
  brw_gewerbliche_bauweise: "Gewerbliche Baufläche",
  brw_sonderbauflaeche: "Sonderbaufläche",
  brw_landwirtschaftliche_flaeche: "Landwirtschaftliche Fläche",
  brw_forstwirtschaftliche_flaeche: "Forstwirtschaftliche Fläche",
  brw_sonstige_flaechen: "Sonstige Flächen",
};

const LAYER_SORT_ORDER = Object.keys(LAYER_LABELS);

const NUTZUNGSART_LABELS: Record<string, string> = {
  "1100": "Wohnbaufläche (W)",
  "1110": "Kleinsiedlungsgebiet (WS)",
  "1120": "Reines Wohngebiet (WR)",
  "1130": "Allgemeines Wohngebiet (WA)",
  "1140": "Besonderes Wohngebiet (WB)",
  "1200": "Gemischte Baufläche (M)",
  "1210": "Dorfgebiet (MD)",
  "1220": "Dörfliches Wohngebiet (MDW)",
  "1230": "Mischgebiet (MI)",
  "1240": "Kerngebiet (MK)",
  "1250": "Urbanes Gebiet (MU)",
  "1300": "Gewerbliche Baufläche (G)",
  "1310": "Gewerbegebiet (GE)",
  "1320": "Industriegebiet (GI)",
  "1400": "Sonderbaufläche (S)",
  "1410": "Sondergebiet für Erholung (SE)",
  "1420": "Sonstige Sondergebiete (SO)",
  "1500": "Baufläche für Gemeinbedarf (GB)",
};

const ERGAENZUNG_LABELS: Record<string, string> = {
  "1001": "Ein- und Zweifamilienhäuser (EFH)",
  "1002": "Mehrfamilienhäuser (MFH)",
  "1003": "Sozialer Mietwohnungsbau (SOW)",
  "1004": "Geschäftshäuser (mehrgeschossig) (GH)",
  "1005": "Wohn- und Geschäftshäuser (WGH)",
  "1006": "Büro- und Geschäftshäuser (BGH)",
  "1007": "Bürohäuser (BH)",
  "1008": "Produktion und Logistik (PL)",
  "1009": "Wochenendhäuser (WO)",
  "1010": "Handel und dienstleistungsorientiertes Gewerbe (GD)",
  "1011": "Ferienhäuser (FEH)",
  "1012": "Freizeit und Touristik (FZT)",
  "1013": "Läden (eingeschossig), nicht großflächiger Einzelhandel (LAD)",
  "1014": "Einkaufszentren, großflächiger Einzelhandel (EKZ)",
  "1015": "Messen, Ausstellungen, Kongresse, Großveranstaltungen aller Art (MES)",
  "1016": "Bildungseinrichtungen (BI)",
  "1017": "Gesundheitseinrichtungen (MED)",
  "1018": "Hafen (HAF)",
  "1019": "Garagen, Stellplatzanlagen, Parkhäuser (GAR)",
  "1020": "Militär (MIL)",
  "1021": "Landwirtschaftliche Produktion (LP)",
  "1022": "Bebaute Flächen im Außenbereich (ASB)",
  "1023": "Bauflächen für Energieerzeugung (EE)",
};

const ENTWICKLUNGSZUSTAND_LABELS: Record<string, string> = {
  "1000": "Baureifes Land (B)",
  "2000": "Rohbauland (R)",
};

const BEITRAGSRECHT_LABELS: Record<string, string> = {
  "1000": "Beitragsfrei (frei)",
};

function mapCodeLabel(code: string | null, table: Record<string, string>): string | null {
  if (!code) return null;
  return table[code] ?? null;
}

function parseBrwValue(raw: unknown): number | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = parseInt(digits, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function layerLabel(layerName: string): string {
  return LAYER_LABELS[layerName] ?? layerName.replace(/^brw_/, "").replace(/_/g, " ");
}

export function computeBorisLandValueEur(
  brwEurPerSqm: number,
  plotSizeSqm: number
): number | null {
  if (!Number.isFinite(brwEurPerSqm) || brwEurPerSqm <= 0) return null;
  if (!Number.isFinite(plotSizeSqm) || plotSizeSqm <= 0) return null;
  return Math.round(brwEurPerSqm * plotSizeSqm);
}

export function primaryBorisResult(results: BorisResult[]): BorisResult | null {
  if (results.length === 0) return null;
  return sortBorisResults(results)[0] ?? null;
}

export function sortBorisResults(results: BorisResult[]): BorisResult[] {
  return [...results].sort((a, b) => {
    const ai = LAYER_SORT_ORDER.indexOf(a.kategorie);
    const bi = LAYER_SORT_ORDER.indexOf(b.kategorie);
    const aRank = ai >= 0 ? ai : LAYER_SORT_ORDER.length;
    const bRank = bi >= 0 ? bi : LAYER_SORT_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;
    if (a.brwEurPerSqm !== b.brwEurPerSqm) return a.brwEurPerSqm - b.brwEurPerSqm;
    return (a.zoneNumber ?? "").localeCompare(b.zoneNumber ?? "");
  });
}

export function parseBorisIdentifyResults(hits: ArcGisIdentifyHit[]): BorisResult[] {
  const results: BorisResult[] = [];

  for (const hit of hits) {
    const layerName = hit.layerName?.trim();
    const attrs = hit.attributes;
    if (!layerName || !attrs) continue;
    if (layerName === "brw_verfuegbarkeit") continue;

    const brwEurPerSqm = parseBrwValue(attrs.Bodenrichtwert ?? attrs.BRW);
    if (brwEurPerSqm == null) continue;

    const nutzungsart = attrString(attrs, "Nutzungsart", "ANU");
    const erganzungNutzung = attrString(attrs, "ErgänzungNutzung", "ErgaenzungNutzung", "ENU");
    const entwicklungszustand = attrString(attrs, "Entwicklungszustand", "EWZ");
    const beitragsrecht = attrString(attrs, "beitragsrechtlicherZustand", "BAZ");

    results.push({
      kategorie: layerName,
      kategorieLabel: layerLabel(layerName),
      brwEurPerSqm,
      nutzungsart,
      nutzungsartLabel: mapCodeLabel(nutzungsart, NUTZUNGSART_LABELS),
      erganzungNutzung,
      erganzungLabel: mapCodeLabel(erganzungNutzung, ERGAENZUNG_LABELS),
      zoneNumber: attrString(attrs, "BodenrichtwertNummer", "BRWNR"),
      zoneName: attrString(attrs, "BodenrichtwertzoneName"),
      gemeinde: attrString(attrs, "Gemeindename"),
      gemarkung: attrString(attrs, "Gemarkungsnummer"),
      stichtag: attrString(attrs, "Stichtag", "TAG"),
      entwicklungszustand:
        mapCodeLabel(entwicklungszustand, ENTWICKLUNGSZUSTAND_LABELS) ?? entwicklungszustand,
      beitragsrecht: mapCodeLabel(beitragsrecht, BEITRAGSRECHT_LABELS) ?? beitragsrecht,
    });
  }

  return sortBorisResults(results);
}

export async function fetchBorisForCoords(
  latitude: number,
  longitude: number
): Promise<BorisFetchOutcome> {
  const identified = await fetchArcGisIdentify({
    mapServerUrl: BORIS_MAP_SERVER_URL,
    latitude,
    longitude,
    service: "boris",
    headers: {
      Referer: BORIS_PORTAL_REFERER,
      Origin: "https://www.bodenrichtwerte-boris.de",
    },
  });

  if (!identified.ok) {
    return { ok: false, error: identified.error };
  }

  const results = parseBorisIdentifyResults(identified.results);
  return { ok: true, results };
}
