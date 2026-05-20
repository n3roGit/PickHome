import { describe, expect, it } from "vitest";
import { federalStateCodeFromAddress, federalStateCodeFromPlz } from "@/lib/federal-state-from-address";
import { resolveFederalStateCode } from "@/lib/purchase-costs";

describe("federalStateCodeFromPlz", () => {
  it("maps Bremen PLZ to HB", () => {
    expect(federalStateCodeFromPlz("28195")).toBe("HB");
  });

  it("maps Munich PLZ to BY", () => {
    expect(federalStateCodeFromPlz("80331")).toBe("BY");
  });
});

describe("federalStateCodeFromAddress", () => {
  it("derives state from PLZ in address", () => {
    expect(federalStateCodeFromAddress("Musterstr. 1, 28195 Bremen")).toBe("HB");
  });

  it("derives state from Bundesland name", () => {
    expect(federalStateCodeFromAddress("Beispielweg 2, Hamburg")).toBe("HH");
  });
});

describe("resolveFederalStateCode", () => {
  it("prefers apartment address over project default", () => {
    expect(
      resolveFederalStateCode({
        projectFederalStateCode: "BY",
        apartmentAddress: "Hauptstr. 1, 28195 Bremen",
      })
    ).toBe("HB");
  });

  it("falls back to project when address has no state", () => {
    expect(
      resolveFederalStateCode({
        projectFederalStateCode: "BY",
        apartmentAddress: null,
      })
    ).toBe("BY");
  });
});
