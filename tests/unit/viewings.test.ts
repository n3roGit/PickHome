import { describe, expect, it } from "vitest";
import { nextViewing } from "@/lib/viewings";

describe("nextViewing", () => {
  const now = new Date("2026-05-19T12:00:00");

  it("returns earliest upcoming viewing", () => {
    const result = nextViewing(
      [
        { scheduledAt: new Date("2026-05-25T10:00:00") },
        { scheduledAt: new Date("2026-05-22T10:00:00") },
        { scheduledAt: new Date("2026-05-18T10:00:00") },
      ],
      now
    );
    expect(result?.toISOString()).toBe(new Date("2026-05-22T10:00:00").toISOString());
  });

  it("returns null when no upcoming viewings", () => {
    expect(
      nextViewing([{ scheduledAt: new Date("2026-05-18T10:00:00") }], now)
    ).toBeNull();
  });
});
