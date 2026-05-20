import type { User } from "@prisma/client";

export const REDIRECT_PREFIX = "NEXT_REDIRECT:";

export const DEFAULT_MOCK_GEOCODE = { latitude: 53.08, longitude: 8.8 };

export const mockAuthState: {
  user: User | null;
} = {
  user: null,
};

export function setMockUser(user: User) {
  mockAuthState.user = user;
}

export function clearMockAuth() {
  mockAuthState.user = null;
}

export function mockGeocodeAddress(address: string) {
  const q = address.trim();
  if (!q) return null;
  return { ...DEFAULT_MOCK_GEOCODE };
}

export async function catchRedirect<T>(
  fn: () => Promise<T>
): Promise<{ redirect?: string; result?: T }> {
  try {
    const result = await fn();
    return { result };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith(REDIRECT_PREFIX)) {
      return { redirect: e.message.slice(REDIRECT_PREFIX.length) };
    }
    throw e;
  }
}

export function redirectError(url: string): Error {
  return new Error(`${REDIRECT_PREFIX}${url}`);
}
