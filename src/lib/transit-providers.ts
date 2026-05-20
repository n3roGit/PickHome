/**
 * Ordered ÖPNV REST providers (transport.rest / bahn.guru). First entry is primary.
 * Override with TRANSIT_API_BASES (comma-separated URLs, no trailing slash).
 */
export const DEFAULT_TRANSIT_API_BASES = [
  "https://v6.db.transport.rest",
  "https://v5.db.api.bahn.guru",
] as const;

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
