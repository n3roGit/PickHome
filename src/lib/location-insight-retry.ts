import type { LocationInsightStatus } from "@/lib/location-insight-types";

/** Minimum wait before background backfill retries a transient fetch error. */
export const LOCATION_INSIGHT_ERROR_RETRY_AFTER_MS = 15 * 60 * 1000;

const RETRYABLE_ERROR_CODES = new Set(["fetch_failed", "request_failed"]);

export function isLocationInsightRetryableError(
  errorMessage: string | null | undefined
): boolean {
  if (!errorMessage) return false;
  if (RETRYABLE_ERROR_CODES.has(errorMessage)) return true;
  if (!errorMessage.startsWith("http_")) return false;
  const status = errorMessage.slice("http_".length);
  return status === "429" || status.startsWith("5");
}

export function isLocationInsightErrorDueForRetry(
  status: LocationInsightStatus | string,
  errorMessage: string | null | undefined,
  fetchedAt: Date,
  nowMs: number = Date.now()
): boolean {
  if (status !== "error") return false;
  if (!isLocationInsightRetryableError(errorMessage)) return false;
  return nowMs - fetchedAt.getTime() >= LOCATION_INSIGHT_ERROR_RETRY_AFTER_MS;
}
