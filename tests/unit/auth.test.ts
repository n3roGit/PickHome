import { describe, expect, it } from "vitest";
import { hashPassword, isAdmin, verifyPassword, ROLE_ADMIN, ROLE_USER } from "@/lib/auth";

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
});
