import {
  backgroundThrottlePause,
  isBackgroundTaskActive,
  yieldToEventLoop,
} from "@/lib/background-task";

export type ExternalService = "nominatim" | "osrm" | "transit" | "listing";

export type FetchExternalOptions = {
  /** Slower rate limits and yields so interactive requests stay responsive. */
  background?: boolean;
  /**
   * When false, background 5xx/429 do not activate service cooldown
   * (e.g. before trying the next transit API provider).
   */
  activateCooldownOnFailure?: boolean;
  /** Override configured retry count (0 = single attempt). */
  maxAttempts?: number;
};

type ServiceConfig = {
  minIntervalMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
};

const NOMINATIM_CONFIG: ServiceConfig = {
  minIntervalMs: 1100,
  maxRetries: 3,
  retryBaseDelayMs: 1500,
  retryMaxDelayMs: 8000,
};

const OSRM_PUBLIC_CONFIG: ServiceConfig = {
  minIntervalMs: 200,
  maxRetries: 3,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 4000,
};

const OSRM_SELF_HOSTED_CONFIG: ServiceConfig = {
  minIntervalMs: 50,
  maxRetries: 2,
  retryBaseDelayMs: 200,
  retryMaxDelayMs: 2000,
};

const TRANSIT_CONFIG: ServiceConfig = {
  minIntervalMs: 1200,
  maxRetries: 2,
  retryBaseDelayMs: 2000,
  retryMaxDelayMs: 8000,
};

const LISTING_CONFIG: ServiceConfig = {
  minIntervalMs: 3000,
  maxRetries: 2,
  retryBaseDelayMs: 2000,
  retryMaxDelayMs: 8000,
};

const foregroundNextSlotAt = new Map<ExternalService, number>();
const backgroundNextSlotAt = new Map<ExternalService, number>();
const serviceCooldownUntil = new Map<ExternalService, number>();
const pendingUnavailable = new Set<ExternalService>();

/** Cooldown after background 5xx/429 — avoids hammering a struggling API. */
const BACKGROUND_SERVICE_COOLDOWN_MS: Record<ExternalService, number> = {
  transit: 120_000,
  osrm: 45_000,
  nominatim: 60_000,
  listing: 60_000,
};

function serviceConfig(service: ExternalService): ServiceConfig {
  if (service === "nominatim") return NOMINATIM_CONFIG;
  if (service === "listing") return LISTING_CONFIG;
  if (service === "transit") return TRANSIT_CONFIG;
  return process.env.OSRM_BASE_URL ? OSRM_SELF_HOSTED_CONFIG : OSRM_PUBLIC_CONFIG;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resetExternalFetchState(): void {
  foregroundNextSlotAt.clear();
  backgroundNextSlotAt.clear();
  serviceCooldownUntil.clear();
  pendingUnavailable.clear();
}

export function isExternalServiceInCooldown(service: ExternalService): boolean {
  return (serviceCooldownUntil.get(service) ?? 0) > Date.now();
}

/** True once after a background fetch was skipped or failed due to API unavailability. */
export function consumeExternalServiceUnavailable(service: ExternalService): boolean {
  if (!pendingUnavailable.has(service)) return false;
  pendingUnavailable.delete(service);
  return true;
}

/** Mark a service unavailable for background cooldown (no HTTP request). */
export function recordExternalServiceFailure(service: ExternalService): void {
  activateServiceCooldown(service);
}

function activateServiceCooldown(service: ExternalService): void {
  serviceCooldownUntil.set(service, Date.now() + BACKGROUND_SERVICE_COOLDOWN_MS[service]);
  pendingUnavailable.add(service);
}

function backgroundMaxAttempts(service: ExternalService, config: ServiceConfig): number {
  if (service === "transit") return 0;
  return Math.min(config.maxRetries, 1);
}

async function waitForRateLimitSlot(
  service: ExternalService,
  minIntervalMs: number,
  background: boolean
): Promise<void> {
  const slots = background ? backgroundNextSlotAt : foregroundNextSlotAt;
  const now = Date.now();
  const slot = Math.max(now, slots.get(service) ?? 0);
  slots.set(service, slot + minIntervalMs);
  const delay = slot - now;
  if (delay > 0) await sleep(delay);
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelayMs(attempt: number, config: ServiceConfig, retryAfterHeader?: string | null): number {
  const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.min(retryAfterSec * 1000, config.retryMaxDelayMs);
  }
  const exponential = config.retryBaseDelayMs * 2 ** attempt;
  return Math.min(exponential, config.retryMaxDelayMs);
}

/**
 * Fetch with per-service rate limiting and retries for transient failures.
 * Returns null after exhausting retries on network errors.
 */
export async function fetchExternal(
  service: ExternalService,
  url: string,
  init?: RequestInit,
  options?: FetchExternalOptions
): Promise<Response | null> {
  const config = serviceConfig(service);
  const intervalMs = options?.background
    ? Math.round(config.minIntervalMs * 2.5)
    : config.minIntervalMs;
  const configuredAttempts = options?.background
    ? backgroundMaxAttempts(service, config)
    : config.maxRetries;
  const maxAttempts = options?.maxAttempts ?? configuredAttempts;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    if (options?.background) {
      if (isExternalServiceInCooldown(service)) {
        pendingUnavailable.add(service);
        return null;
      }
      await backgroundThrottlePause(150);
    } else if (isBackgroundTaskActive()) {
      await yieldToEventLoop();
    }

    await waitForRateLimitSlot(service, intervalMs, !!options?.background);

    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (!isRetriableStatus(res.status)) return res;

      if (options?.background) {
        if (options.activateCooldownOnFailure !== false) {
          activateServiceCooldown(service);
        }
        return null;
      }

      if (attempt === maxAttempts) return res;
      await sleep(retryDelayMs(attempt, config, res.headers.get("Retry-After")));
    } catch {
      if (options?.background) {
        if (options.activateCooldownOnFailure !== false) {
          activateServiceCooldown(service);
        }
        return null;
      }
      if (attempt === maxAttempts) return null;
      await sleep(retryDelayMs(attempt, config));
    }
  }

  return null;
}
