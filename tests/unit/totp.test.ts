import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import {
  generateRecoveryCodesPlain,
  generateTotpSecret,
  normalizeRecoveryCode,
  verifyTotpCode,
} from "@/lib/totp";

describe("totp", () => {
  it("generates and verifies a TOTP code", () => {
    const secret = generateTotpSecret();
    const user = { username: "testuser", totpSecret: secret };
    const totp = new OTPAuth.TOTP({
      issuer: "PickHome",
      label: user.username,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const token = totp.generate();
    expect(verifyTotpCode(user, token)).toBe(true);
    expect(verifyTotpCode(user, "000000")).toBe(false);
  });

  it("normalizes recovery codes", () => {
    expect(normalizeRecoveryCode(" ABCD-EFGH-IJKL ")).toBe("abcd-efgh-ijkl");
  });

  it("generates recovery codes in expected format", () => {
    const codes = generateRecoveryCodesPlain();
    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}$/);
  });
});
