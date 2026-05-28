import { fetchExternal, type FetchExternalOptions } from "@/lib/external-fetch";

export const BFS_RADON_WFS_URL =
  "https://www.imis.bfs.de/ogc/opendata/ows?service=WFS&version=1.1.0";

export const BFS_RADON_SOURCE_URL =
  "https://www.bfs.de/DE/themen/ion/umwelt/radon/karten/wohnraeume.html";

const LAYER_INDOOR = "opendata:radon_wohnraeume";
const LAYER_SOIL = "opendata:radonpotential";
const LAYER_PRECAUTION = "opendata:radonvorsorgegebiete";

export type RadonPrecautionArea = {
  name: string;
  description: string | null;
};

export type RadonBfsData = {
  municipalityName: string;
  municipalityType: string | null;
  indoorRadonBqPerM3: number | null;
  soilPotentialPercent: number | null;
  precautionAreas: RadonPrecautionArea[];
  headline: string;
  assessment: string;
};

type WfsFeatureCollection = {
  features?: {
    properties?: Record<string, unknown>;
  }[];
};

function wfsBBoxUrl(typeName: string, lon: number, lat: number, delta: number): string {
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(",");
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName,
    outputFormat: "application/json",
    bbox: `${bbox},EPSG:4326`,
    maxFeatures: "5",
  });
  return `${BFS_RADON_WFS_URL.split("?")[0]}?${params}`;
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export function buildRadonAssessment(
  indoorBq: number | null,
  soilPercent: number | null,
  inPrecautionArea: boolean
): { headline: string; assessment: string } {
  if (inPrecautionArea) {
    return {
      headline: "Radon-Vorsorgegebiet",
      assessment:
        "Amtlich ausgewiesenes Vorsorgegebiet — erhöhte Anforderungen an Neubauten; Messung in der Wohnung empfohlen.",
    };
  }
  if (indoorBq != null && indoorBq >= 200) {
    return {
      headline: `Gemeinde-Durchschnitt ${indoorBq} Bq/m³ — deutlich erhöht`,
      assessment:
        "Prognose auf Gemeindeebene; Einzelgebäude können stark abweichen — Radonmessung empfohlen.",
    };
  }
  if (indoorBq != null && indoorBq >= 100) {
    return {
      headline: `Gemeinde-Durchschnitt ${indoorBq} Bq/m³ — erhöht`,
      assessment:
        "Über dem Orientierungswert von 100 Bq/m³ (Gemeinde-Prognose) — Messung kann sinnvoll sein.",
    };
  }
  if (indoorBq != null) {
    return {
      headline: `Gemeinde-Durchschnitt ${indoorBq} Bq/m³`,
      assessment:
        "Prognose für die Gemeinde — keine Aussage für einzelne Wohnungen; Messung klärt den Einzelfall.",
    };
  }
  if (soilPercent != null && soilPercent >= 50) {
    return {
      headline: `Boden-Radonpotenzial ${soilPercent.toLocaleString("de-DE")} %`,
      assessment: "Erhöhtes Radonpotenzial im Boden — Wohnungsmessung empfohlen.",
    };
  }
  return {
    headline: "Keine Radon-Prognose für diesen Punkt",
    assessment: "BfS-Karten liefern hier keinen Treffer.",
  };
}

export function parseRadonWfsFeatures(input: {
  indoorFeatures: WfsFeatureCollection | null;
  soilFeatures: WfsFeatureCollection | null;
  precautionFeatures: WfsFeatureCollection | null;
}): RadonBfsData {
  const indoorProps = input.indoorFeatures?.features?.[0]?.properties;
  const soilProps = input.soilFeatures?.features?.[0]?.properties;
  const precautionAreas: RadonPrecautionArea[] = (input.precautionFeatures?.features ?? [])
    .map((f) => ({
      name: parseString(f.properties?.NAME) ?? parseString(f.properties?.name) ?? "Vorsorgegebiet",
      description:
        parseString(f.properties?.name_description) ?? parseString(f.properties?.bez),
    }))
    .filter((a) => a.name.length > 0);

  const indoorRadonBqPerM3 = parseNumber(indoorProps?.AM);
  const soilPotentialPercent = parseNumber(soilProps?.grp_pb_);
  const municipalityName = parseString(indoorProps?.GEN) ?? "—";
  const municipalityType = parseString(indoorProps?.BEZ);
  const inPrecautionArea = precautionAreas.length > 0;
  const { headline, assessment } = buildRadonAssessment(
    indoorRadonBqPerM3,
    soilPotentialPercent,
    inPrecautionArea
  );

  return {
    municipalityName,
    municipalityType,
    indoorRadonBqPerM3,
    soilPotentialPercent,
    precautionAreas,
    headline,
    assessment,
  };
}

async function fetchWfsLayer(
  typeName: string,
  lon: number,
  lat: number,
  delta: number,
  fetchOptions?: FetchExternalOptions
): Promise<WfsFeatureCollection | null> {
  const url = wfsBBoxUrl(typeName, lon, lat, delta);
  const res = await fetchExternal(
    "radon",
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "PickHome/1.0 (radon wfs; self-hosted)",
      },
      signal: AbortSignal.timeout(30_000),
    },
    fetchOptions
  );
  if (!res?.ok) return null;
  try {
    return (await res.json()) as WfsFeatureCollection;
  } catch {
    return null;
  }
}

export function formatRadonCompact(data: RadonBfsData | null): string {
  if (!data) return "—";
  if (data.precautionAreas.length > 0) return "Vorsorgegebiet";
  if (data.indoorRadonBqPerM3 != null) return `${data.indoorRadonBqPerM3} Bq/m³ (${data.municipalityName})`;
  if (data.soilPotentialPercent != null) return `Boden ${data.soilPotentialPercent} %`;
  return "—";
}

export async function fetchRadonBfsForCoords(
  latitude: number,
  longitude: number,
  options?: { background?: boolean }
): Promise<
  | { ok: true; data: RadonBfsData; noData?: boolean }
  | { ok: false; error: string }
> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: "invalid_coords" };
  }

  const fetchOptions: FetchExternalOptions | undefined = options?.background
    ? { background: true }
    : undefined;

  const [indoorFeatures, soilFeatures, precautionFeatures] = await Promise.all([
    fetchWfsLayer(LAYER_INDOOR, longitude, latitude, 0.002, fetchOptions),
    fetchWfsLayer(LAYER_SOIL, longitude, latitude, 0.05, fetchOptions),
    fetchWfsLayer(LAYER_PRECAUTION, longitude, latitude, 0.01, fetchOptions),
  ]);

  if (!indoorFeatures && !soilFeatures && !precautionFeatures) {
    return { ok: false, error: "fetch_failed" };
  }

  const data = parseRadonWfsFeatures({
    indoorFeatures,
    soilFeatures,
    precautionFeatures,
  });

  const hasData =
    data.indoorRadonBqPerM3 != null ||
    data.soilPotentialPercent != null ||
    data.precautionAreas.length > 0;

  return { ok: true, data, noData: !hasData };
}
