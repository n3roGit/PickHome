import type { FederalStateCode } from "@/lib/purchase-costs";

const VALID_STATE_CODES = new Set<FederalStateCode>([
  "BY",
  "SN",
  "HH",
  "BW",
  "BB",
  "HE",
  "MV",
  "NW",
  "RP",
  "SL",
  "SH",
  "TH",
  "BE",
  "HB",
  "NI",
  "ST",
]);

const STATE_NAMES: { code: FederalStateCode; name: string }[] = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" },
];

/** Default Bundesland by first two PLZ digits (rough; not legal advice). */
const PLZ_PREFIX2: Record<string, FederalStateCode> = {
  "01": "SN",
  "02": "SN",
  "03": "SN",
  "04": "SN",
  "06": "SN",
  "07": "SN",
  "08": "SN",
  "09": "SN",
  "10": "BE",
  "11": "BE",
  "12": "BB",
  "13": "BB",
  "14": "BB",
  "15": "BB",
  "16": "BB",
  "17": "MV",
  "18": "MV",
  "19": "MV",
  "20": "HH",
  "21": "HH",
  "22": "HH",
  "23": "SH",
  "24": "SH",
  "25": "SH",
  "26": "NI",
  "27": "NI",
  "28": "NI",
  "29": "NI",
  "30": "NI",
  "31": "NI",
  "32": "NW",
  "33": "NW",
  "34": "HE",
  "35": "HE",
  "36": "HE",
  "37": "TH",
  "38": "NI",
  "39": "ST",
  "40": "NW",
  "41": "NW",
  "42": "NW",
  "44": "NW",
  "45": "NW",
  "46": "NW",
  "47": "NW",
  "48": "NW",
  "49": "NW",
  "50": "NW",
  "51": "NW",
  "52": "NW",
  "53": "NW",
  "54": "RP",
  "55": "RP",
  "56": "RP",
  "57": "NW",
  "58": "NW",
  "59": "NW",
  "60": "HE",
  "61": "HE",
  "63": "RP",
  "64": "HE",
  "65": "RP",
  "66": "RP",
  "67": "RP",
  "68": "BW",
  "69": "BW",
  "70": "BW",
  "71": "BW",
  "72": "BW",
  "73": "BW",
  "74": "BW",
  "75": "BW",
  "76": "BW",
  "77": "BW",
  "78": "BW",
  "79": "BW",
  "80": "BY",
  "81": "BY",
  "82": "BY",
  "83": "BY",
  "84": "BY",
  "85": "BY",
  "86": "BY",
  "87": "BY",
  "88": "BW",
  "89": "BW",
  "90": "BY",
  "91": "BY",
  "92": "BY",
  "93": "BY",
  "94": "BY",
  "95": "BY",
  "96": "BY",
  "97": "BY",
  "98": "ST",
  "99": "TH",
};

/** Overrides where 2-digit prefix is ambiguous. */
const PLZ_PREFIX3: Record<string, FederalStateCode> = {
  "274": "HB",
  "275": "HB",
  "276": "HB",
  "277": "HB",
  "278": "HB",
  "279": "HB",
  "281": "HB",
  "282": "HB",
  "283": "HB",
  "284": "HB",
  "285": "HB",
  "286": "HB",
  "287": "HB",
  "388": "ST",
  "389": "ST",
  "390": "ST",
  "391": "ST",
  "392": "ST",
  "393": "ST",
  "394": "ST",
  "395": "ST",
  "396": "ST",
  "397": "ST",
  "398": "ST",
  "399": "ST",
  "660": "SL",
  "661": "SL",
  "662": "SL",
  "663": "SL",
  "664": "SL",
  "665": "SL",
  "666": "SL",
  "667": "SL",
  "668": "SL",
  "669": "SL",
};

const STATE_NAMES_BY_LENGTH = [...STATE_NAMES].sort((a, b) => b.name.length - a.name.length);

function parseStateCodeToken(raw: string): FederalStateCode | null {
  const code = raw.trim().toUpperCase();
  return VALID_STATE_CODES.has(code as FederalStateCode) ? (code as FederalStateCode) : null;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractGermanPlz(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/);
  return match?.[1] ?? null;
}

export function federalStateCodeFromPlz(plz: string): FederalStateCode | null {
  const digits = plz.replace(/\D/g, "");
  if (digits.length !== 5) return null;
  const prefix3 = digits.slice(0, 3);
  const from3 = PLZ_PREFIX3[prefix3];
  if (from3) return from3;
  const prefix2 = digits.slice(0, 2);
  return PLZ_PREFIX2[prefix2] ?? null;
}

export function federalStateCodeFromAddress(address: string | null | undefined): FederalStateCode | null {
  const trimmed = String(address ?? "").trim();
  if (!trimmed) return null;

  const plz = extractGermanPlz(trimmed);
  if (plz) {
    const fromPlz = federalStateCodeFromPlz(plz);
    if (fromPlz) return fromPlz;
  }

  const haystack = normalizeForMatch(trimmed);
  for (const state of STATE_NAMES_BY_LENGTH) {
    const needle = normalizeForMatch(state.name);
    if (needle.length >= 4 && haystack.includes(needle)) {
      return state.code;
    }
  }

  const codeMatch = trimmed.match(/\b([A-Za-z]{2})\b/g);
  if (codeMatch) {
    for (const token of codeMatch) {
      const code = parseStateCodeToken(token);
      if (code) return code;
    }
  }

  return null;
}
