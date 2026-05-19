/** Rough ancillary purchase cost estimates (not legal/tax advice). */

export const NOTARY_REGISTRY_RATE = 0.02;

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

export type PurchaseCostLine = {
  key: "landTransferTax" | "notaryRegistry" | "broker";
  label: string;
  rate: number;
  amount: number;
};

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
}): PurchaseCostEstimate {
  const state = federalStateByCode(input.federalStateCode);
  const landTransferTax = Math.round(input.price * state.landTransferTaxRate);
  const notaryRegistry = Math.round(input.price * NOTARY_REGISTRY_RATE);
  const brokerRate = input.brokerInvolved ? brokerBuyerShareRate(state.code) : 0;
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
