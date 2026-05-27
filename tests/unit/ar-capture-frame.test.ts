import { describe, expect, it } from "vitest";
import { videoCoverSourceRect } from "@/lib/ar-capture-frame";

describe("ar-capture-frame", () => {
  it("videoCoverSourceRect crops sides of a wide video on a tall canvas", () => {
    const crop = videoCoverSourceRect(1920, 1080, 390, 844);
    expect(crop).not.toBeNull();
    expect(crop!.sh).toBeCloseTo(1080, 0);
    expect(crop!.sw).toBeLessThan(1920);
    expect(crop!.sx).toBeGreaterThan(0);
    expect(crop!.sy).toBeCloseTo(0, 0);
  });
});
