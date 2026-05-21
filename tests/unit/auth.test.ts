import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashPassword,
  isAdmin,
  parseRememberLoginFlag,
  ROLE_ADMIN,
  ROLE_USER,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";

describe("auth", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("secret");
    expect(await verifyPassword("secret", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("detects admin role", () => {
    expect(isAdmin({ role: ROLE_ADMIN })).toBe(true);
    expect(isAdmin({ role: ROLE_USER })).toBe(false);
  });

  it("signs and verifies session tokens", () => {
    const token = createSessionToken("user-1", Date.now());
    expect(verifySessionToken(token)).toBe("user-1");
  });

  it("rejects tampered session tokens", () => {
    const token = createSessionToken("user-1", Date.now());
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: "user-2", issuedAt: Date.now() })).toString("base64url");
    expect(verifySessionToken(`${tamperedPayload}.${signature}`)).toBeNull();
    expect(verifySessionToken(`${payload}.bad-signature`)).toBeNull();
  });

  it("rejects expired session tokens", () => {
    const expired = createSessionToken("user-1", Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(verifySessionToken(expired)).toBeNull();
  });

  it("reads remember-login checkbox from form data", () => {
    const checked = new FormData();
    checked.set("remember", "on");
    expect(parseRememberLoginFlag(checked)).toBe(true);

    const unchecked = new FormData();
    expect(parseRememberLoginFlag(unchecked)).toBe(false);
  });
});
