import { federalStateCodeFromAddress } from "@/lib/federal-state-from-address";

/** Rough ancillary purchase cost estimates (not legal/tax advice). */

export const NOTARY_REGISTRY_RATE = 0.02;

/** Rough guideline: monthly housing burden above this share of net income is flagged. */
export const AFFORDABILITY_WARN_THRESHOLD = 0.35;

/** Fallback when no project interest rate is set (rough estimate only). */
export const DEFAULT_INTEREST_RATE = 0.035;

export type FederalStateCode =
  | "BY"
  | "SN"
  | "HH"
  | "BW"
  | "BB"
  | "HE"
  | "MV"
  | "NW"
  | "RP"
  | "SL"
  | "SH"
  | "TH"
  | "BE"
  | "HB"
  | "NI"
  | "ST";

export type FederalState = {
  code: FederalStateCode;
  name: string;
  landTransferTaxRate: number;
};

/** Grunderwerbsteuer rates (approximate, 2025/2026). */
export const FEDERAL_STATES: FederalState[] = [
  { code: "BY", name: "Bayern", landTransferTaxRate: 0.035 },
  { code: "SN", name: "Sachsen", landTransferTaxRate: 0.035 },
  { code: "HH", name: "Hamburg", landTransferTaxRate: 0.045 },
  { code: "BW", name: "Baden-Württemberg", landTransferTaxRate: 0.05 },
  { code: "BB", name: "Brandenburg", landTransferTaxRate: 0.05 },
  { code: "HE", name: "Hessen", landTransferTaxRate: 0.05 },
  { code: "MV", name: "Mecklenburg-Vorpommern", landTransferTaxRate: 0.05 },
  { code: "NW", name: "Nordrhein-Westfalen", landTransferTaxRate: 0.05 },
  { code: "RP", name: "Rheinland-Pfalz", landTransferTaxRate: 0.05 },
  { code: "SL", name: "Saarland", landTransferTaxRate: 0.05 },
  { code: "SH", name: "Schleswig-Holstein", landTransferTaxRate: 0.05 },
  { code: "TH", name: "Thüringen", landTransferTaxRate: 0.05 },
  { code: "BE", name: "Berlin", landTransferTaxRate: 0.055 },
  { code: "HB", name: "Bremen", landTransferTaxRate: 0.055 },
  { code: "NI", name: "Niedersachsen", landTransferTaxRate: 0.055 },
  { code: "ST", name: "Sachsen-Anhalt", landTransferTaxRate: 0.055 },
];

const LAND_TRANSFER_TAX_BY_CODE = new Map(
  FEDERAL_STATES.map((s) => [s.code, s.landTransferTaxRate])
);

/** Buyer share when total commission is often ~5.95 % (split 50/50). */
const BROKER_BUYER_SHARE_LOW = 0.02975;
/** Buyer share when total commission is often ~7.14 % (split 50/50). */
const BROKER_BUYER_SHARE_DEFAULT = 0.0357;

const LOW_TOTAL_COMMISSION_STATES = new Set<FederalStateCode>([
  "BE",
  "HB",
  "BB",
  "HH",
  "HE",
  "NI",
]);

export function parseFederalStateCode(raw: string | null | undefined): FederalStateCode | null {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!code) return null;
  return LAND_TRANSFER_TAX_BY_CODE.has(code as FederalStateCode)
    ? (code as FederalStateCode)
    : null;
}

export function federalStateByCode(code: FederalStateCode): FederalState {
  const state = FEDERAL_STATES.find((s) => s.code === code);
  if (!state) throw new Error(`Unknown federal state: ${code}`);
  return state;
}

export function brokerBuyerShareRate(stateCode: FederalStateCode): number {
  return LOW_TOTAL_COMMISSION_STATES.has(stateCode)
    ? BROKER_BUYER_SHARE_LOW
    : BROKER_BUYER_SHARE_DEFAULT;
}

/** Parse buyer share from form input (percent, e.g. "2,975" → 0.02975). */
export function parseBrokerBuyerRatePercent(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const pct = parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return Number((pct / 100).toFixed(6));
}

export function formatBrokerBuyerRateForInput(rate: number | null | undefined): string {
  if (rate == null) return "";
  const pct = Math.round(rate * 100_000) / 1000;
  return String(pct).replace(".", ",");
}

export function resolveBrokerBuyerRate(
  stateCode: FederalStateCode,
  projectRate: number | null | undefined
): number {
  if (projectRate != null) return projectRate;
  return brokerBuyerShareRate(stateCode);
}

/** Apartment address overrides project default when a Bundesland can be derived. */
export function resolveFederalStateCode(input: {
  projectFederalStateCode: string | null | undefined;
  apartmentAddress: string | null | undefined;
}): FederalStateCode | null {
  const fromAddress = federalStateCodeFromAddress(input.apartmentAddress);
  if (fromAddress) return fromAddress;
  return parseFederalStateCode(input.projectFederalStateCode);
}

export type PurchaseCostLine = {
  key: "landTransferTax" | "notaryRegistry" | "broker" | "renovation";
  label: string;
  /** Rate as decimal; 0 for fixed amounts like renovation */
  rate: number;
  amount: number;
};

export type ApartmentOngoingCosts = {
  hoaFeeMonthly?: number | null;
  heatingCostMonthly?: number | null;
  propertyTaxAnnual?: number | null;
  price?: number | null;
  sizeSqm?: number | null;
  plotSizeSqm?: number | null;
};

/** Rough annual property tax when not entered (orientation only, not tax advice). */
export function estimatePropertyTaxAnnual(input: {
  price: number | null | undefined;
  sizeSqm?: number | null;
  plotSizeSqm?: number | null;
}): number | null {
  if (input.price == null || input.price <= 0) return null;
  const baseRate = 0.002;
  let rate = baseRate;
  const plot = input.plotSizeSqm;
  const living = input.sizeSqm;
  if (plot != null && plot > 0 && living != null && living > 0) {
    const ratio = plot / living;
    if (ratio > 1.2) rate *= 1 + Math.min(0.5, (ratio - 1) * 0.15);
  } else if (plot != null && plot > 400) {
    rate *= 1.15;
  }
  return Math.max(100, Math.round(input.price * rate));
}

export function resolvePropertyTaxAnnual(costs: ApartmentOngoingCosts): {
  annual: number | null;
  isEstimate: boolean;
} {
  const stored = costs.propertyTaxAnnual;
  if (stored != null && stored > 0) {
    return { annual: stored, isEstimate: false };
  }
  const estimated = estimatePropertyTaxAnnual({
    price: costs.price,
    sizeSqm: costs.sizeSqm,
    plotSizeSqm: costs.plotSizeSqm,
  });
  if (estimated == null) return { annual: null, isEstimate: false };
  return { annual: estimated, isEstimate: true };
}

export function apartmentMonthlyMaintenance(costs: ApartmentOngoingCosts): number {
  const hoa = costs.hoaFeeMonthly ?? 0;
  const heating = costs.heatingCostMonthly ?? 0;
  const { annual } = resolvePropertyTaxAnnual(costs);
  const taxMonthly = annual ? Math.round(annual / 12) : 0;
  return hoa + heating + taxMonthly;
}

export function totalAcquisitionCost(
  purchase: PurchaseCostEstimate,
  renovationCost?: number | null
): number {
  return purchase.totalWithPrice + (renovationCost ?? 0);
}

export function purchaseCostLinesWithRenovation(
  estimate: PurchaseCostEstimate,
  renovationCost?: number | null
): PurchaseCostLine[] {
  const lines = [...estimate.lines];
  if (renovationCost != null && renovationCost > 0) {
    lines.push({
      key: "renovation",
      label: "Sanierung (einmalig, grob)",
      rate: 0,
      amount: renovationCost,
    });
  }
  return lines;
}

export type PurchaseCostEstimate = {
  state: FederalState;
  brokerInvolved: boolean;
  lines: PurchaseCostLine[];
  ancillaryTotal: number;
  totalWithPrice: number;
};

export function estimatePurchaseCosts(input: {
  price: number;
  federalStateCode: FederalStateCode;
  brokerInvolved: boolean;
  brokerBuyerRate?: number | null;
}): PurchaseCostEstimate {
  const state = federalStateByCode(input.federalStateCode);
  const landTransferTax = Math.round(input.price * state.landTransferTaxRate);
  const notaryRegistry = Math.round(input.price * NOTARY_REGISTRY_RATE);
  const brokerRate = input.brokerInvolved
    ? resolveBrokerBuyerRate(state.code, input.brokerBuyerRate)
    : 0;
  const broker = input.brokerInvolved ? Math.round(input.price * brokerRate) : 0;

  const lines: PurchaseCostLine[] = [
    {
      key: "landTransferTax",
      label: `Grunderwerbsteuer (${state.name})`,
      rate: state.landTransferTaxRate,
      amount: landTransferTax,
    },
    {
      key: "notaryRegistry",
      label: "Notar & Grundbuch (grob)",
      rate: NOTARY_REGISTRY_RATE,
      amount: notaryRegistry,
    },
  ];

  if (input.brokerInvolved) {
    lines.push({
      key: "broker",
      label: "Makleranteil Käufer (grob)",
      rate: brokerRate,
      amount: broker,
    });
  }

  const ancillaryTotal = landTransferTax + notaryRegistry + broker;

  return {
    state,
    brokerInvolved: input.brokerInvolved,
    lines,
    ancillaryTotal,
    totalWithPrice: input.price + ancillaryTotal,
  };
}

export function formatPercent(rate: number): string {
  const pct = rate * 100;
  const rounded = Math.round(pct * 1000) / 1000;
  return `${String(rounded).replace(".", ",")} %`;
}

/** Parse annual interest from form input (percent, e.g. "3,5" → 0.035). */
export function parseInterestRatePercent(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const pct = parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return Number((pct / 100).toFixed(6));
}

export function formatInterestRateForInput(rate: number | null | undefined): string {
  if (rate == null) return "";
  const pct = Math.round(rate * 1000) / 10;
  return String(pct).replace(".", ",");
}

export function parsePositiveInt(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const value = parseInt(trimmed.replace(/\D/g, ""), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export type FinancingEstimate = {
  totalCost: number;
  equityAmount: number;
  loanAmount: number;
  loanTermYears: number;
  interestRate: number;
  interestRateIsDefault: boolean;
  monthlyPayment: number;
  /** Sum of all monthly payments over the loan term (principal + interest). */
  totalLoanPayments: number;
  /** totalLoanPayments − loanAmount */
  totalInterest: number;
  /** equityAmount + totalLoanPayments — rough lifetime cash cost incl. interest */
  lifetimeTotal: number;
};

/** Fixed-rate annuity: monthly payment for full amortization over termYears. */
export function estimateMonthlyPayment(
  loanAmount: number,
  annualInterestRate: number,
  termYears: number
): number {
  if (loanAmount <= 0 || termYears <= 0) return 0;
  const months = termYears * 12;
  const monthlyRate = annualInterestRate / 12;
  if (monthlyRate === 0) return Math.round(loanAmount / months);
  const factor = Math.pow(1 + monthlyRate, months);
  return Math.round((loanAmount * monthlyRate * factor) / (factor - 1));
}

export function estimateFinancing(input: {
  totalCost: number;
  equityAmount: number;
  loanTermYears: number;
  interestRate?: number | null;
}): FinancingEstimate | null {
  if (input.loanTermYears <= 0 || input.equityAmount < 0) return null;
  const loanAmount = Math.max(0, input.totalCost - input.equityAmount);
  const interestRateIsDefault = input.interestRate == null;
  const interestRate = input.interestRate ?? DEFAULT_INTEREST_RATE;
  const monthlyPayment = estimateMonthlyPayment(loanAmount, interestRate, input.loanTermYears);
  const totalLoanPayments = monthlyPayment * input.loanTermYears * 12;
  const totalInterest = Math.max(0, totalLoanPayments - loanAmount);
  return {
    totalCost: input.totalCost,
    equityAmount: input.equityAmount,
    loanAmount,
    loanTermYears: input.loanTermYears,
    interestRate,
    interestRateIsDefault,
    monthlyPayment,
    totalLoanPayments,
    totalInterest,
    lifetimeTotal: input.equityAmount + totalLoanPayments,
  };
}

export type AffordabilityLevel = "ok" | "warn";

export type AffordabilityEstimate = {
  monthlyPayment: number;
  monthlyMaintenance: number;
  totalMonthlyBurden: number;
  netHouseholdIncome: number;
  burdenShare: number;
  level: AffordabilityLevel;
};

export function estimateAffordability(input: {
  monthlyPayment: number;
  netHouseholdIncome: number;
  monthlyMaintenance?: number | null;
}): AffordabilityEstimate | null {
  if (input.netHouseholdIncome <= 0) return null;
  const monthlyMaintenance = input.monthlyMaintenance ?? 0;
  const totalMonthlyBurden = input.monthlyPayment + monthlyMaintenance;
  const burdenShare = totalMonthlyBurden / input.netHouseholdIncome;
  return {
    monthlyPayment: input.monthlyPayment,
    monthlyMaintenance,
    totalMonthlyBurden,
    netHouseholdIncome: input.netHouseholdIncome,
    burdenShare,
    level: burdenShare > AFFORDABILITY_WARN_THRESHOLD ? "warn" : "ok",
  };
}

export function formatBurdenShare(share: number): string {
  const pct = Math.round(share * 1000) / 10;
  return `${String(pct).replace(".", ",")} %`;
}

export type ProjectFinanceSettings = {
  federalStateCode: string | null;
  brokerBuyerRate: number | null;
  equityAmount: number | null;
  loanTermYears: number | null;
  interestRate: number | null;
  netHouseholdIncome: number | null;
};

export type ApartmentCompareInput = {
  price: number | null;
  sizeSqm: number | null;
  plotSizeSqm?: number | null;
  brokerInvolved: boolean;
  address: string | null;
  hoaFeeMonthly?: number | null;
  heatingCostMonthly?: number | null;
  propertyTaxAnnual?: number | null;
  renovationCost?: number | null;
};

export type ApartmentCompareMetrics = {
  totalCost: number | null;
  monthlyPayment: number | null;
  burdenShare: number | null;
  burdenLevel: AffordabilityLevel | null;
};

export function apartmentCompareMetrics(
  apartment: ApartmentCompareInput,
  finance: ProjectFinanceSettings
): ApartmentCompareMetrics {
  const stateCode = resolveFederalStateCode({
    projectFederalStateCode: finance.federalStateCode,
    apartmentAddress: apartment.address,
  });
  if (apartment.price == null || !stateCode) {
    return { totalCost: null, monthlyPayment: null, burdenShare: null, burdenLevel: null };
  }

  const costs = estimatePurchaseCosts({
    price: apartment.price,
    federalStateCode: stateCode,
    brokerInvolved: apartment.brokerInvolved,
    brokerBuyerRate: finance.brokerBuyerRate,
  });
  const acquisitionTotal = totalAcquisitionCost(costs, apartment.renovationCost);
  const monthlyMaintenance = apartmentMonthlyMaintenance(apartment);

  if (finance.equityAmount == null || finance.loanTermYears == null) {
    return {
      totalCost: acquisitionTotal,
      monthlyPayment: null,
      burdenShare: null,
      burdenLevel: null,
    };
  }

  const financing = estimateFinancing({
    totalCost: acquisitionTotal,
    equityAmount: finance.equityAmount,
    loanTermYears: finance.loanTermYears,
    interestRate: finance.interestRate,
  });
  if (!financing) {
    return {
      totalCost: acquisitionTotal,
      monthlyPayment: null,
      burdenShare: null,
      burdenLevel: null,
    };
  }

  const affordability =
    finance.netHouseholdIncome != null
      ? estimateAffordability({
          monthlyPayment: financing.monthlyPayment,
          netHouseholdIncome: finance.netHouseholdIncome,
          monthlyMaintenance,
        })
      : null;

  return {
    totalCost: acquisitionTotal,
    monthlyPayment: financing.monthlyPayment,
    burdenShare: affordability?.burdenShare ?? null,
    burdenLevel: affordability?.level ?? null,
  };
}
