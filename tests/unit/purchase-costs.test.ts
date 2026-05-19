import { describe, expect, it } from "vitest";
import {
  brokerBuyerShareRate,
  estimatePurchaseCosts,
  formatPercent,
  parseFederalStateCode,
} from "@/lib/purchase-costs";

describe("parseFederalStateCode", () => {
  it("accepts valid codes", () => {
    expect(parseFederalStateCode("hb")).toBe("HB");
    expect(parseFederalStateCode("BY")).toBe("BY");
  });

  it("rejects unknown codes", () => {
    expect(parseFederalStateCode("XX")).toBeNull();
    expect(parseFederalStateCode("")).toBeNull();
  });
});

describe("estimatePurchaseCosts", () => {
  it("computes Bremen without broker", () => {
    const result = estimatePurchaseCosts({
      price: 300_000,
      federalStateCode: "HB",
      brokerInvolved: false,
    });
    expect(result.ancillaryTotal).toBe(22_500);
    expect(result.totalWithPrice).toBe(322_500);
    expect(result.lines).toHaveLength(2);
  });

  it("computes Bremen with broker", () => {
    const result = estimatePurchaseCosts({
      price: 300_000,
      federalStateCode: "HB",
      brokerInvolved: true,
    });
    expect(result.ancillaryTotal).toBe(31_425);
    expect(result.totalWithPrice).toBe(331_425);
    expect(result.lines).toHaveLength(3);
  });
});

describe("brokerBuyerShareRate", () => {
  it("uses lower share in Bremen", () => {
    expect(brokerBuyerShareRate("HB")).toBeLessThan(brokerBuyerShareRate("BY"));
  });
});

describe("formatPercent", () => {
  it("formats decimal rates", () => {
    expect(formatPercent(0.055)).toBe("5,5 %");
  });
});
