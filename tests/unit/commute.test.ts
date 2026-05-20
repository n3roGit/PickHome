import { describe, expect, it } from "vitest";
import { commuteUnavailableMessage } from "@/lib/commute";

describe("commuteUnavailableMessage", () => {
  it("returns null for no reason", () => {
    expect(commuteUnavailableMessage(null)).toBeNull();
  });

  it("describes each unavailable reason", () => {
    expect(commuteUnavailableMessage("missing_apartment_coords")).toContain("Koordinaten");
    expect(commuteUnavailableMessage("missing_address_coords")).toContain("geocodiert");
    expect(commuteUnavailableMessage("routing_failed")).toContain("Route");
  });
});
