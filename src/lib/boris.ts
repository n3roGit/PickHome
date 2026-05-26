import { fetchExternal } from "@/lib/external-fetch";

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

type ArcGisIdentifyHit = {
  layerName?: string;
  attributes?: Record<string, unknown>;
};

function attrString(attrs: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = attrs[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

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
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: "invalid_coords" };
  }

  const extentPad = 0.015;
  const params = new URLSearchParams({
    f: "json",
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers: "all",
    tolerance: "8",
    mapExtent: [
      longitude - extentPad,
      latitude - extentPad,
      longitude + extentPad,
      latitude + extentPad,
    ].join(","),
    imageDisplay: "800,600,96",
    returnGeometry: "false",
  });

  const res = await fetchExternal(
    "boris",
    `${BORIS_MAP_SERVER_URL}/identify?${params}`,
    {
      headers: {
        Referer: BORIS_PORTAL_REFERER,
        Origin: "https://www.bodenrichtwerte-boris.de",
        Accept: "application/json",
        "User-Agent": "PickHome/1.0 (boris lookup; self-hosted)",
      },
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!res) {
    return { ok: false, error: "fetch_failed" };
  }

  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` };
  }

  let payload: { results?: ArcGisIdentifyHit[]; error?: { message?: string } };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  if (payload.error?.message) {
    return { ok: false, error: payload.error.message };
  }

  const results = parseBorisIdentifyResults(payload.results ?? []);
  return { ok: true, results };
}
