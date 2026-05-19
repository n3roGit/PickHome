type Attempt = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Attempt>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

export function resetRateLimit(key: string) {
  store.delete(key);
}

export function clearRateLimits() {
  store.clear();
}
