import { describe, expect, it, vi, beforeEach } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  })),
}));

describe("pending TOTP cookie", () => {
  beforeEach(() => {
    cookieStore.clear();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-totp-cookie");
  });

  it("round-trips user id after setPendingTotpLogin", async () => {
    const { setPendingTotpLogin, getPendingTotpLogin, getPendingTotpUserId } = await import(
      "@/lib/totp"
    );
    const userId = "00000000-0000-4000-8000-000000000099";
    await setPendingTotpLogin(userId, true);
    expect(await getPendingTotpUserId()).toBe(userId);
    expect(await getPendingTotpLogin()).toEqual({ userId, remember: true });
  });

  it("stores remember=false when not requested", async () => {
    const { setPendingTotpLogin, getPendingTotpLogin } = await import("@/lib/totp");
    const userId = "00000000-0000-4000-8000-000000000098";
    await setPendingTotpLogin(userId);
    expect(await getPendingTotpLogin()).toEqual({ userId, remember: false });
  });

  it("rejects tampered pending cookie", async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set("ph_totp_pending", "bad.payload", { path: "/" });
    const { getPendingTotpUserId } = await import("@/lib/totp");
    expect(await getPendingTotpUserId()).toBeNull();
  });
});
