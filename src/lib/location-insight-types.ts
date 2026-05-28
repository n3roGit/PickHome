export const LOCATION_INSIGHT_DOMAINS = ["overpass", "noise", "flood"] as const;

export type LocationInsightDomain = (typeof LOCATION_INSIGHT_DOMAINS)[number];

export type LocationInsightStatus = "ok" | "no_coords" | "no_data" | "error";

export function isLocationInsightDomain(value: string): value is LocationInsightDomain {
  return (LOCATION_INSIGHT_DOMAINS as readonly string[]).includes(value);
}
