export const TRAVEL_MODES = ["foot", "bike", "driving", "transit"] as const;

export type TravelMode = (typeof TRAVEL_MODES)[number];

export const DEFAULT_TRAVEL_MODE: TravelMode = "driving";

export function parseTravelMode(raw: string | null | undefined): TravelMode {
  const value = String(raw ?? "").trim().toLowerCase();
  return TRAVEL_MODES.includes(value as TravelMode) ? (value as TravelMode) : DEFAULT_TRAVEL_MODE;
}

export function travelModeLabel(mode: TravelMode): string {
  switch (mode) {
    case "foot":
      return "Zu Fuß";
    case "bike":
      return "Rad";
    case "driving":
      return "Auto";
    case "transit":
      return "ÖPNV";
  }
}
