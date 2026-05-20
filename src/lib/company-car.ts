export const COMPANY_CAR_RATES = ["standard", "hybrid", "electric"] as const;

export type CompanyCarRate = (typeof COMPANY_CAR_RATES)[number];

/** Monthly commute benefit as a fraction of list price per one-way distance km. */
export const COMMUTE_RATE_PER_KM: Record<CompanyCarRate, number> = {
  standard: 0.0003,
  hybrid: 0.00015,
  electric: 0.000075,
};

export function parseCompanyCarRate(raw: string | null | undefined): CompanyCarRate {
  const value = String(raw ?? "").trim().toLowerCase();
  return COMPANY_CAR_RATES.includes(value as CompanyCarRate)
    ? (value as CompanyCarRate)
    : "standard";
}

export function companyCarRateLabel(rate: CompanyCarRate): string {
  switch (rate) {
    case "standard":
      return "Benzin/Diesel (0,03 %/km)";
    case "hybrid":
      return "Plug-in-Hybrid (0,015 %/km)";
    case "electric":
      return "Elektro (0,0075 %/km)";
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
