export const COMPANY_CAR_RATES = ["standard", "hybrid", "electric"] as const;

export type CompanyCarRate = (typeof COMPANY_CAR_RATES)[number];

export const COMPANY_CAR_COMMUTE_METHODS = ["distance", "trips"] as const;

export type CompanyCarCommuteMethod = (typeof COMPANY_CAR_COMMUTE_METHODS)[number];

/** Monthly base benefit as a fraction of list price (private use). */
export const BASE_RATE_MONTHLY: Record<CompanyCarRate, number> = {
  standard: 0.01,
  hybrid: 0.005,
  electric: 0.0025,
};

/** Monthly commute benefit as a fraction of list price per one-way distance km. */
export const COMMUTE_RATE_PER_KM: Record<CompanyCarRate, number> = {
  standard: 0.0003,
  hybrid: 0.00015,
  electric: 0.000075,
};

/** Monthly commute benefit per one-way km and one trip (0,002 % rule). */
export const COMMUTE_RATE_PER_TRIP_KM: Record<CompanyCarRate, number> = {
  standard: 0.00002,
  hybrid: 0.00001,
  electric: 0.000005,
};

export type CompanyCarSettings = {
  rate: CompanyCarRate;
  listPriceEuros: number;
  commuteMethod: CompanyCarCommuteMethod;
  officeTripsPerMonth: number | null;
  contributionEur: number;
  selfPaidCostsEur: number;
  employerFuelCard: boolean;
  marginalTaxRatePercent?: number | null;
};

export type CompanyCarBenefitBreakdown = {
  baseGrossEur: number;
  commuteGrossEur: number;
  deductionsEur: number;
  totalGrossEur: number;
  baseNetEur: number;
  commuteNetEur: number;
  totalNetEur: number;
  marginalTaxRatePercent: number;
  commuteMethod: CompanyCarCommuteMethod;
  officeTripsPerMonth: number | null;
  employerFuelCard: boolean;
};

export const DEFAULT_MARGINAL_TAX_RATE_PERCENT = 42;

export const ELECTRIC_LIST_PRICE_CAP_EUR = 100_000;

export const MARGINAL_TAX_RATE_OPTIONS = [
  {
    percent: 25,
    hint: "bis ca. 30.000 € zu versteuerndes Einkommen (unterer Bereich)",
  },
  {
    percent: 30,
    hint: "ca. 30.000–45.000 € z. v. E. (Mittelfeld, z. B. Steuerklasse I ohne hohe Zusatzeinkünfte)",
  },
  {
    percent: 35,
    hint: "ca. 45.000–60.000 € z. v. E. (oberes Mittelfeld)",
  },
  {
    percent: 42,
    hint: "ab ca. 68.000 € z. v. E. (Spitzensteuersatz — typisch für Gutverdiener)",
  },
  {
    percent: 45,
    hint: "ab ca. 278.000 € z. v. E. (Reichensteuer)",
  },
] as const;

export type MarginalTaxRateOption = (typeof MARGINAL_TAX_RATE_OPTIONS)[number];

export function parseCompanyCarRate(raw: string | null | undefined): CompanyCarRate {
  const value = String(raw ?? "").trim().toLowerCase();
  return COMPANY_CAR_RATES.includes(value as CompanyCarRate)
    ? (value as CompanyCarRate)
    : "standard";
}

export function parseCompanyCarCommuteMethod(
  raw: string | null | undefined
): CompanyCarCommuteMethod {
  const value = String(raw ?? "").trim().toLowerCase();
  return COMPANY_CAR_COMMUTE_METHODS.includes(value as CompanyCarCommuteMethod)
    ? (value as CompanyCarCommuteMethod)
    : "distance";
}

export function parseOptionalEuroAmount(raw: string | null | undefined): number {
  const trimmed = String(raw ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (!trimmed) return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

export function parseOfficeTripsPerMonth(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > 31) return null;
  return value;
}

export function companyCarRateLabel(rate: CompanyCarRate): string {
  switch (rate) {
    case "standard":
      return "Benzin/Diesel (1 % + 0,03 %/km Arbeitsweg)";
    case "hybrid":
      return "Plug-in-Hybrid begünstigt (0,5 % + 0,015 %/km Arbeitsweg)";
    case "electric":
      return "Elektro bis 100.000 € BLP (0,25 % + 0,0075 %/km Arbeitsweg)";
  }
}

export function companyCarCommuteMethodLabel(method: CompanyCarCommuteMethod): string {
  switch (method) {
    case "distance":
      return "Entfernungspauschale (0,03 % × km einfach)";
    case "trips":
      return "Fahrtenpauschale (0,002 % × km × Bürofahrten/Monat)";
  }
}

export function marginalTaxRateOptionLabel(option: MarginalTaxRateOption): string {
  return `${option.percent} % — ${option.hint}`;
}

export function marginalTaxRateOptionByPercent(percent: number): MarginalTaxRateOption | undefined {
  return MARGINAL_TAX_RATE_OPTIONS.find((option) => option.percent === percent);
}

/** Bruttolistenpreis rounded down to full €100 per German tax rules. */
export function roundListPrice(listPriceEuros: number): number {
  if (!Number.isFinite(listPriceEuros) || listPriceEuros <= 0) return 0;
  return Math.floor(listPriceEuros / 100) * 100;
}

/** Entfernungskilometer: one-way distance rounded up to full km. */
export function distanceKmOneWay(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  return Math.ceil(distanceMeters / 1000);
}

function effectiveCompanyCarFactors(input: { rate: CompanyCarRate; listPriceEuros: number }) {
  const listPrice = roundListPrice(input.listPriceEuros);
  if (input.rate === "electric" && listPrice > ELECTRIC_LIST_PRICE_CAP_EUR) {
    return {
      baseRate: BASE_RATE_MONTHLY.hybrid,
      commuteRatePerKm: COMMUTE_RATE_PER_KM.hybrid,
      commuteRatePerTripKm: COMMUTE_RATE_PER_TRIP_KM.hybrid,
    };
  }

  return {
    baseRate: BASE_RATE_MONTHLY[input.rate],
    commuteRatePerKm: COMMUTE_RATE_PER_KM[input.rate],
    commuteRatePerTripKm: COMMUTE_RATE_PER_TRIP_KM[input.rate],
  };
}

export function monthlyBaseBenefitEur(input: {
  listPriceEuros: number;
  rate: CompanyCarRate;
}): number | null {
  const listPrice = roundListPrice(input.listPriceEuros);
  if (listPrice <= 0) return null;
  const { baseRate } = effectiveCompanyCarFactors(input);
  const monthly = listPrice * baseRate;
  return Math.round(monthly * 100) / 100;
}

export function monthlyCommuteBenefitEur(input: {
  listPriceEuros: number;
  rate: CompanyCarRate;
  distanceMeters: number;
  commuteMethod?: CompanyCarCommuteMethod;
  officeTripsPerMonth?: number | null;
}): number | null {
  const listPrice = roundListPrice(input.listPriceEuros);
  const km = distanceKmOneWay(input.distanceMeters);
  if (listPrice <= 0 || km <= 0) return null;

  const { commuteRatePerKm, commuteRatePerTripKm } = effectiveCompanyCarFactors(input);
  const commuteMethod = input.commuteMethod ?? "distance";

  if (commuteMethod === "trips") {
    const trips = input.officeTripsPerMonth;
    if (trips == null || trips <= 0) return null;
    const monthly = listPrice * commuteRatePerTripKm * km * trips;
    return Math.round(monthly * 100) / 100;
  }

  const monthly = listPrice * commuteRatePerKm * km;
  return Math.round(monthly * 100) / 100;
}

export function resolveMarginalTaxRatePercent(raw: number | null | undefined): number {
  if (raw == null) return DEFAULT_MARGINAL_TAX_RATE_PERCENT;
  if (!Number.isInteger(raw) || raw < 1 || raw > 50) return DEFAULT_MARGINAL_TAX_RATE_PERCENT;
  return raw;
}

export function parseMarginalTaxRatePercent(raw: string | null | undefined): number {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return DEFAULT_MARGINAL_TAX_RATE_PERCENT;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1 || value > 50) return DEFAULT_MARGINAL_TAX_RATE_PERCENT;
  return Math.round(value);
}

export function estimateNetLoadEur(grossEur: number, marginalTaxRatePercent: number): number {
  return Math.round(grossEur * (marginalTaxRatePercent / 100) * 100) / 100;
}

export function monthlyCompanyCarDeductionsEur(input: {
  contributionEur?: number | null;
  selfPaidCostsEur?: number | null;
  employerFuelCard?: boolean | null;
}): number {
  const contribution = Math.max(0, input.contributionEur ?? 0);
  const selfPaid = input.employerFuelCard ? 0 : Math.max(0, input.selfPaidCostsEur ?? 0);
  return Math.round((contribution + selfPaid) * 100) / 100;
}

export function monthlyCompanyCarBenefitEur(input: {
  listPriceEuros: number;
  rate: CompanyCarRate;
  distanceMeters: number;
  commuteMethod?: CompanyCarCommuteMethod;
  officeTripsPerMonth?: number | null;
  contributionEur?: number | null;
  selfPaidCostsEur?: number | null;
  employerFuelCard?: boolean | null;
  marginalTaxRatePercent?: number | null;
}): CompanyCarBenefitBreakdown | null {
  const commuteMethod = input.commuteMethod ?? "distance";
  const employerFuelCard = input.employerFuelCard ?? true;
  const baseGrossEur = monthlyBaseBenefitEur(input);
  const commuteGrossEur = monthlyCommuteBenefitEur({
    ...input,
    commuteMethod,
  });
  if (baseGrossEur == null || commuteGrossEur == null) return null;

  const deductionsEur = monthlyCompanyCarDeductionsEur({
    contributionEur: input.contributionEur,
    selfPaidCostsEur: input.selfPaidCostsEur,
    employerFuelCard,
  });
  const marginalTaxRatePercent = resolveMarginalTaxRatePercent(input.marginalTaxRatePercent);
  const totalBeforeDeductions = Math.round((baseGrossEur + commuteGrossEur) * 100) / 100;
  const totalGrossEur = Math.max(0, Math.round((totalBeforeDeductions - deductionsEur) * 100) / 100);

  return {
    baseGrossEur,
    commuteGrossEur,
    deductionsEur,
    totalGrossEur,
    baseNetEur: estimateNetLoadEur(baseGrossEur, marginalTaxRatePercent),
    commuteNetEur: estimateNetLoadEur(commuteGrossEur, marginalTaxRatePercent),
    totalNetEur: estimateNetLoadEur(totalGrossEur, marginalTaxRatePercent),
    marginalTaxRatePercent,
    commuteMethod,
    officeTripsPerMonth: commuteMethod === "trips" ? (input.officeTripsPerMonth ?? null) : null,
    employerFuelCard,
  };
}

export function formatCommuteBenefitEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseListPriceEuros(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}
