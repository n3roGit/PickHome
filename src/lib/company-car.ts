export const COMPANY_CAR_RATES = ["standard", "hybrid", "electric"] as const;

export type CompanyCarRate = (typeof COMPANY_CAR_RATES)[number];

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

export type CompanyCarBenefitBreakdown = {
  baseGrossEur: number;
  commuteGrossEur: number;
  totalGrossEur: number;
  baseNetEur: number;
  commuteNetEur: number;
  totalNetEur: number;
  marginalTaxRatePercent: number;
};

export const DEFAULT_MARGINAL_TAX_RATE_PERCENT = 42;

export const MARGINAL_TAX_RATE_OPTIONS = [25, 30, 35, 42, 45] as const;

export function parseCompanyCarRate(raw: string | null | undefined): CompanyCarRate {
  const value = String(raw ?? "").trim().toLowerCase();
  return COMPANY_CAR_RATES.includes(value as CompanyCarRate)
    ? (value as CompanyCarRate)
    : "standard";
}

export function companyCarRateLabel(rate: CompanyCarRate): string {
  switch (rate) {
    case "standard":
      return "Benzin/Diesel (1 % + 0,03 %/km Arbeitsweg)";
    case "hybrid":
      return "Plug-in-Hybrid (0,5 % + 0,015 %/km Arbeitsweg)";
    case "electric":
      return "Elektro (0,25 % + 0,0075 %/km Arbeitsweg)";
  }
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

export function monthlyBaseBenefitEur(input: {
  listPriceEuros: number;
  rate: CompanyCarRate;
}): number | null {
  const listPrice = roundListPrice(input.listPriceEuros);
  if (listPrice <= 0) return null;
  const monthly = listPrice * BASE_RATE_MONTHLY[input.rate];
  return Math.round(monthly * 100) / 100;
}

export function monthlyCommuteBenefitEur(input: {
  listPriceEuros: number;
  rate: CompanyCarRate;
  distanceMeters: number;
}): number | null {
  const listPrice = roundListPrice(input.listPriceEuros);
  const km = distanceKmOneWay(input.distanceMeters);
  if (listPrice <= 0 || km <= 0) return null;
  const monthly = listPrice * COMMUTE_RATE_PER_KM[input.rate] * km;
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

export function monthlyCompanyCarBenefitEur(input: {
  listPriceEuros: number;
  rate: CompanyCarRate;
  distanceMeters: number;
  marginalTaxRatePercent?: number | null;
}): CompanyCarBenefitBreakdown | null {
  const baseGrossEur = monthlyBaseBenefitEur(input);
  const commuteGrossEur = monthlyCommuteBenefitEur(input);
  if (baseGrossEur == null || commuteGrossEur == null) return null;

  const marginalTaxRatePercent = resolveMarginalTaxRatePercent(input.marginalTaxRatePercent);
  const totalGrossEur = Math.round((baseGrossEur + commuteGrossEur) * 100) / 100;

  return {
    baseGrossEur,
    commuteGrossEur,
    totalGrossEur,
    baseNetEur: estimateNetLoadEur(baseGrossEur, marginalTaxRatePercent),
    commuteNetEur: estimateNetLoadEur(commuteGrossEur, marginalTaxRatePercent),
    totalNetEur: estimateNetLoadEur(totalGrossEur, marginalTaxRatePercent),
    marginalTaxRatePercent,
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
