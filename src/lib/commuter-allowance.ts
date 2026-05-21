import { resolveMarginalTaxRatePercent } from "@/lib/company-car";

/** Entfernungspauschale: first 20 km (one-way), 2025 and earlier. */
export const ALLOWANCE_RATE_NEAR_EUR = 0.3;
/** Entfernungspauschale: from km 21 (one-way), 2025 and earlier. */
export const ALLOWANCE_RATE_FAR_EUR = 0.38;
/** Uniform rate per km from 2026 (one-way). */
export const ALLOWANCE_RATE_UNIFORM_FROM_2026_EUR = 0.38;

export const ALLOWANCE_NEAR_KM_LIMIT = 20;

/** Typical workdays in a year before absences (Mon–Fri, excl. public holidays). */
export const DEFAULT_BASE_WORK_DAYS_PER_YEAR = 251;
export const DEFAULT_VACATION_DAYS = 30;
export const DEFAULT_SICK_DAYS = 0;
export const DEFAULT_HOME_OFFICE_DAYS = 0;
export const DEFAULT_COMMUTE_DAYS_PER_YEAR = 220;

/** Werbungskosten-Pauschale (2025); only allowance above this yields extra tax benefit. */
export const WERBUNGSKOSTEN_PAUSCHALE_EUR = 1230;

export type CommuteDaysSource = "explicit" | "trips" | "calendar" | "default";

export type CommuterAllowanceSettings = {
  daysPerYear: number | null;
  vacationDays: number | null;
  sickDays: number | null;
  homeOfficeDays: number | null;
  officeTripsPerMonth: number | null;
};

export type CommuterAllowanceBreakdown = {
  kmOneWay: number;
  daysPerYear: number;
  daysSource: CommuteDaysSource;
  dailyAllowanceEur: number;
  annualAllowanceEur: number;
  annualTaxBenefitEur: number;
  marginalTaxRatePercent: number;
  allowanceYear: number;
};

/** Pendlerpauschale: one-way km rounded down (§ 9 EStG). */
export function commuteKmOneWayForAllowance(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  return Math.floor(distanceMeters / 1000);
}

export function parseCommuteAllowanceDays(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > 366) return null;
  return value;
}

export function parseOptionalDayCount(
  raw: string | null | undefined,
  fallback: number
): number {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return fallback;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0 || value > 366) return fallback;
  return value;
}

export function resolveVacationDays(raw: number | null | undefined): number {
  if (raw == null) return DEFAULT_VACATION_DAYS;
  if (!Number.isInteger(raw) || raw < 0 || raw > 120) return DEFAULT_VACATION_DAYS;
  return raw;
}

export function resolveSickDays(raw: number | null | undefined): number {
  if (raw == null) return DEFAULT_SICK_DAYS;
  if (!Number.isInteger(raw) || raw < 0 || raw > 366) return DEFAULT_SICK_DAYS;
  return raw;
}

export function resolveHomeOfficeDays(raw: number | null | undefined): number {
  if (raw == null) return DEFAULT_HOME_OFFICE_DAYS;
  if (!Number.isInteger(raw) || raw < 0 || raw > 366) return DEFAULT_HOME_OFFICE_DAYS;
  return raw;
}

export function resolveCommuteDaysPerYear(settings: CommuterAllowanceSettings): {
  days: number;
  source: CommuteDaysSource;
} {
  if (settings.daysPerYear != null && settings.daysPerYear > 0) {
    return { days: settings.daysPerYear, source: "explicit" };
  }

  const trips = settings.officeTripsPerMonth;
  if (trips != null && trips > 0) {
    const derived = Math.min(trips * 12, 366);
    return { days: derived, source: "trips" };
  }

  const vacation = resolveVacationDays(settings.vacationDays);
  const sick = resolveSickDays(settings.sickDays);
  const homeOffice = resolveHomeOfficeDays(settings.homeOfficeDays);
  const fromCalendar = Math.max(
    0,
    DEFAULT_BASE_WORK_DAYS_PER_YEAR - vacation - sick - homeOffice
  );
  if (fromCalendar > 0) {
    return { days: fromCalendar, source: "calendar" };
  }

  return { days: DEFAULT_COMMUTE_DAYS_PER_YEAR, source: "default" };
}

export function dailyCommuterAllowanceEur(kmOneWay: number, year: number): number {
  if (kmOneWay <= 0) return 0;

  if (year >= 2026) {
    return Math.round(kmOneWay * ALLOWANCE_RATE_UNIFORM_FROM_2026_EUR * 100) / 100;
  }

  const nearKm = Math.min(kmOneWay, ALLOWANCE_NEAR_KM_LIMIT);
  const farKm = Math.max(0, kmOneWay - ALLOWANCE_NEAR_KM_LIMIT);
  const daily = nearKm * ALLOWANCE_RATE_NEAR_EUR + farKm * ALLOWANCE_RATE_FAR_EUR;
  return Math.round(daily * 100) / 100;
}

export function annualCommuterAllowanceEur(input: {
  distanceMeters: number;
  settings: CommuterAllowanceSettings;
  year?: number;
}): { kmOneWay: number; daysPerYear: number; daysSource: CommuteDaysSource; annualEur: number; dailyEur: number; year: number } | null {
  const kmOneWay = commuteKmOneWayForAllowance(input.distanceMeters);
  if (kmOneWay <= 0) return null;

  const year = input.year ?? new Date().getFullYear();
  const { days, source } = resolveCommuteDaysPerYear(input.settings);
  if (days <= 0) return null;

  const dailyEur = dailyCommuterAllowanceEur(kmOneWay, year);
  const annualEur = Math.round(dailyEur * days * 100) / 100;

  return { kmOneWay, daysPerYear: days, daysSource: source, annualEur, dailyEur, year };
}

/** Estimated tax benefit after Werbungskosten-Pauschale (simplified, no other Werbungskosten). */
export function annualCommuterTaxBenefitEur(
  annualAllowanceEur: number,
  marginalTaxRatePercent: number
): number {
  if (annualAllowanceEur <= WERBUNGSKOSTEN_PAUSCHALE_EUR) return 0;
  const extra = annualAllowanceEur - WERBUNGSKOSTEN_PAUSCHALE_EUR;
  return Math.round(extra * (marginalTaxRatePercent / 100) * 100) / 100;
}

export function commuterAllowanceBreakdown(input: {
  distanceMeters: number;
  settings: CommuterAllowanceSettings;
  marginalTaxRatePercent?: number | null;
  year?: number;
}): CommuterAllowanceBreakdown | null {
  const annual = annualCommuterAllowanceEur({
    distanceMeters: input.distanceMeters,
    settings: input.settings,
    year: input.year,
  });
  if (!annual) return null;

  const marginalTaxRatePercent = resolveMarginalTaxRatePercent(input.marginalTaxRatePercent);

  return {
    kmOneWay: annual.kmOneWay,
    daysPerYear: annual.daysPerYear,
    daysSource: annual.daysSource,
    dailyAllowanceEur: annual.dailyEur,
    annualAllowanceEur: annual.annualEur,
    annualTaxBenefitEur: annualCommuterTaxBenefitEur(annual.annualEur, marginalTaxRatePercent),
    marginalTaxRatePercent,
    allowanceYear: annual.year,
  };
}

export function commuteDaysSourceLabel(source: CommuteDaysSource): string {
  switch (source) {
    case "explicit":
      return "eingabe Pendeltage/Jahr";
    case "trips":
      return "abgeleitet aus Bürofahrten/Monat";
    case "calendar":
      return "geschätzt aus Arbeitstagen minus Abwesenheit";
    case "default":
      return "Standardannahme";
  }
}
