/**
 * Ordered ÖPNV REST providers (transport.rest / bahn.guru). First entry is primary.
 * Override with TRANSIT_API_BASES (comma-separated URLs, no trailing slash).
 */
export const DEFAULT_TRANSIT_API_BASES = [
  "https://v6.db.transport.rest",
  "https://v5.db.api.bahn.guru",
] as const;

/**
 * GTFS timetable routing via MOTIS when REST providers fail.
 * [gtfs.de](https://gtfs.de) publishes feeds (no public /journeys API); default instance
 * uses Transitous. Self-host MOTIS with gtfs.de feeds and set TRANSIT_GTFS_API_BASE.
 * Set TRANSIT_GTFS_API_BASE=off to disable.
 */
export const DEFAULT_TRANSIT_GTFS_API_BASE = "https://api.transitous.org";

export function resolveTransitApiBases(): string[] {
  const override = process.env.TRANSIT_API_BASES?.trim();
  if (override) {
    return override
      .split(/[\s,]+/)
      .map((s) => s.replace(/\/$/, ""))
      .filter(Boolean);
  }
  return [...DEFAULT_TRANSIT_API_BASES];
}

export function resolveTransitGtfsApiBase(): string | null {
  const override = process.env.TRANSIT_GTFS_API_BASE?.trim();
  if (override) {
    const normalized = override.replace(/\/$/, "").toLowerCase();
    if (normalized === "off" || normalized === "false" || normalized === "0") {
      return null;
    }
    return override.replace(/\/$/, "");
  }
  return DEFAULT_TRANSIT_GTFS_API_BASE;
}
