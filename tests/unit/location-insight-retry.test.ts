import { describe, expect, it } from "vitest";
import {
  isLocationInsightErrorDueForRetry,
  isLocationInsightRetryableError,
  LOCATION_INSIGHT_ERROR_RETRY_AFTER_MS,
} from "@/lib/location-insight-retry";

describe("isLocationInsightRetryableError", () => {
  it("treats fetch and network errors as retryable", () => {
    expect(isLocationInsightRetryableError("fetch_failed")).toBe(true);
    expect(isLocationInsightRetryableError("request_failed")).toBe(true);
  });

  it("treats throttling and server HTTP codes as retryable", () => {
    expect(isLocationInsightRetryableError("http_429")).toBe(true);
    expect(isLocationInsightRetryableError("http_500")).toBe(true);
    expect(isLocationInsightRetryableError("http_503")).toBe(true);
  });

  it("does not retry client or domain errors", () => {
    expect(isLocationInsightRetryableError("invalid_coords")).toBe(false);
    expect(isLocationInsightRetryableError("http_404")).toBe(false);
    expect(isLocationInsightRetryableError("no_station")).toBe(false);
    expect(isLocationInsightRetryableError(null)).toBe(false);
  });
});

describe("isLocationInsightErrorDueForRetry", () => {
  const now = Date.UTC(2026, 4, 28, 12, 0, 0);

  it("returns false before retry backoff elapses", () => {
    const fetchedAt = new Date(now - LOCATION_INSIGHT_ERROR_RETRY_AFTER_MS + 60_000);
    expect(
      isLocationInsightErrorDueForRetry("error", "fetch_failed", fetchedAt, now)
    ).toBe(false);
  });

  it("returns true after retry backoff elapses", () => {
    const fetchedAt = new Date(now - LOCATION_INSIGHT_ERROR_RETRY_AFTER_MS - 1);
    expect(
      isLocationInsightErrorDueForRetry("error", "fetch_failed", fetchedAt, now)
    ).toBe(true);
  });

  it("returns false for non-retryable errors", () => {
    const fetchedAt = new Date(now - LOCATION_INSIGHT_ERROR_RETRY_AFTER_MS - 1);
    expect(
      isLocationInsightErrorDueForRetry("error", "invalid_coords", fetchedAt, now)
    ).toBe(false);
  });
});
