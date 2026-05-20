export type ExternalService = "nominatim" | "osrm";

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

const nextSlotAt = new Map<ExternalService, number>();

function serviceConfig(service: ExternalService): ServiceConfig {
  if (service === "nominatim") return NOMINATIM_CONFIG;
  return process.env.OSRM_BASE_URL ? OSRM_SELF_HOSTED_CONFIG : OSRM_PUBLIC_CONFIG;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resetExternalFetchState(): void {
  nextSlotAt.clear();
}

async function waitForRateLimitSlot(service: ExternalService, minIntervalMs: number): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt.get(service) ?? 0);
  nextSlotAt.set(service, slot + minIntervalMs);
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
  init?: RequestInit
): Promise<Response | null> {
  const config = serviceConfig(service);

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    await waitForRateLimitSlot(service, config.minIntervalMs);

    try {
      const res = await fetch(url, init);
      if (res.ok || !isRetriableStatus(res.status) || attempt === config.maxRetries) {
        return res;
      }
      await sleep(retryDelayMs(attempt, config, res.headers.get("Retry-After")));
    } catch {
      if (attempt === config.maxRetries) return null;
      await sleep(retryDelayMs(attempt, config));
    }
  }

  return null;
}
