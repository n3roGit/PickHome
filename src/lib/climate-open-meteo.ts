import { fetchExternal, type FetchExternalOptions } from "@/lib/external-fetch";

export const CLIMATE_OPEN_METEO_SOURCE_URL = "https://open-meteo.com/en/docs/climate-api";

const CLIMATE_API = "https://climate-api.open-meteo.com/v1/climate";
const CLIMATE_MODEL = "MRI_AGCM3_2_S";
const PERIOD_START = "1991-01-01";
const PERIOD_END = "2020-12-31";

export type ClimateNormalsData = {
  periodLabel: string;
  meanAnnualMaxTempC: number | null;
  meanSummerMaxTempC: number | null;
  meanWinterMaxTempC: number | null;
  meanAnnualPrecipitationMm: number | null;
  meanRainyDaysPerYear: number | null;
  headline: string;
  assessment: string;
};

type DailyClimatePayload = {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    precipitation_sum?: number[];
  };
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function monthFromIsoDate(iso: string): number {
  const m = parseInt(iso.slice(5, 7), 10);
  return Number.isFinite(m) ? m : 0;
}

export function computeClimateNormalsFromDaily(payload: DailyClimatePayload): ClimateNormalsData {
  const times = payload.daily?.time ?? [];
  const temps = payload.daily?.temperature_2m_max ?? [];
  const precips = payload.daily?.precipitation_sum ?? [];
  const periodLabel = "1991–2020";

  if (times.length === 0 || temps.length === 0) {
    return {
      periodLabel,
      meanAnnualMaxTempC: null,
      meanSummerMaxTempC: null,
      meanWinterMaxTempC: null,
      meanAnnualPrecipitationMm: null,
      meanRainyDaysPerYear: null,
      headline: "Keine Klimadaten",
      assessment: "Klimawerte konnten nicht berechnet werden.",
    };
  }

  const yearTemps = new Map<number, number[]>();
  const yearPrecip = new Map<number, number>();
  const yearRainyDays = new Map<number, number>();
  const summerTemps: number[] = [];
  const winterTemps: number[] = [];

  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    const temp = temps[i];
    const precip = precips[i] ?? 0;
    if (!date || temp == null || !Number.isFinite(temp)) continue;

    const year = parseInt(date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;

    if (!yearTemps.has(year)) yearTemps.set(year, []);
    yearTemps.get(year)!.push(temp);
    yearPrecip.set(year, (yearPrecip.get(year) ?? 0) + precip);
    if (precip >= 1) {
      yearRainyDays.set(year, (yearRainyDays.get(year) ?? 0) + 1);
    }

    const month = monthFromIsoDate(date);
    if (month >= 6 && month <= 8) summerTemps.push(temp);
    if (month === 12 || month <= 2) winterTemps.push(temp);
  }

  const annualMeans = [...yearTemps.values()].map(
    (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  );
  const annualPrecips = [...yearPrecip.values()];
  const rainyDayCounts = [...yearRainyDays.values()];

  const mean = (arr: number[]) =>
    arr.length > 0 ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const meanAnnualMaxTempC = mean(annualMeans);
  const meanSummerMaxTempC = mean(summerTemps);
  const meanWinterMaxTempC = mean(winterTemps);
  const meanAnnualPrecipitationMm = mean(annualPrecips);
  const meanRainyDaysPerYear =
    rainyDayCounts.length > 0
      ? Math.round(rainyDayCounts.reduce((a, b) => a + b, 0) / rainyDayCounts.length)
      : null;

  const parts: string[] = [];
  if (meanAnnualMaxTempC != null) parts.push(`Ø Tageshöchstwert ${meanAnnualMaxTempC} °C`);
  if (meanAnnualPrecipitationMm != null) parts.push(`${meanAnnualPrecipitationMm} mm/Jahr Niederschlag`);
  const headline = parts.length > 0 ? parts.join(" · ") : "Keine Klimadaten";

  let assessment = "Modellwerte (Open-Meteo) für das 30-Jahres-Klima — Orientierung für Heizung und Feuchte.";
  if (meanWinterMaxTempC != null && meanWinterMaxTempC < 3) {
    assessment += " Kalte Winter — höherer Heizbedarf wahrscheinlich.";
  } else if (meanSummerMaxTempC != null && meanSummerMaxTempC > 24) {
    assessment += " Warme Sommer — Kühlung/Sommerhitze beachten.";
  }
  if (meanRainyDaysPerYear != null && meanRainyDaysPerYear > 120) {
    assessment += " Viele Regentage — Feuchte/Schimmel-Risiko beachten.";
  }

  return {
    periodLabel,
    meanAnnualMaxTempC,
    meanSummerMaxTempC,
    meanWinterMaxTempC,
    meanAnnualPrecipitationMm,
    meanRainyDaysPerYear,
    headline,
    assessment,
  };
}

export function formatClimateCompact(data: ClimateNormalsData | null): string {
  if (!data?.meanAnnualMaxTempC) return "—";
  return `${data.meanAnnualMaxTempC} °C · ${data.meanAnnualPrecipitationMm ?? "?"} mm/Jahr`;
}

export async function fetchClimateNormalsForCoords(
  latitude: number,
  longitude: number,
  options?: { background?: boolean }
): Promise<
  | { ok: true; data: ClimateNormalsData; noData?: boolean }
  | { ok: false; error: string }
> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: "invalid_coords" };
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: PERIOD_START,
    end_date: PERIOD_END,
    models: CLIMATE_MODEL,
    daily: "temperature_2m_max,precipitation_sum",
  });

  const res = await fetchExternal(
    "climate",
    `${CLIMATE_API}?${params}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "PickHome/1.0 (climate; self-hosted)",
      },
      signal: AbortSignal.timeout(45_000),
    },
    options?.background ? { background: true } : undefined
  );

  if (!res) return { ok: false, error: "fetch_failed" };
  if (!res.ok) return { ok: false, error: `http_${res.status}` };

  let payload: DailyClimatePayload;
  try {
    payload = (await res.json()) as DailyClimatePayload;
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const data = computeClimateNormalsFromDaily(payload);
  const hasData = data.meanAnnualMaxTempC != null;
  return { ok: true, data, noData: !hasData };
}
