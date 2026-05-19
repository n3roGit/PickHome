import { describe, expect, it } from "vitest";
import { readPasswordPair } from "@/lib/password";

describe("readPasswordPair", () => {
  it("accepts matching passwords", () => {
    const fd = new FormData();
    fd.set("password", "secret");
    fd.set("passwordConfirm", "secret");
    expect(readPasswordPair(fd)).toEqual({ ok: true, password: "secret" });
  });

  it("rejects short password", () => {
    const fd = new FormData();
    fd.set("password", "ab");
    fd.set("passwordConfirm", "ab");
    expect(readPasswordPair(fd)).toEqual({ ok: false, error: "password_too_short" });
  });

  it("rejects mismatch", () => {
    const fd = new FormData();
    fd.set("password", "secret");
    fd.set("passwordConfirm", "other");
    expect(readPasswordPair(fd)).toEqual({ ok: false, error: "password_mismatch" });
  });
});
