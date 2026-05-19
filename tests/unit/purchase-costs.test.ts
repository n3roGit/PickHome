import { describe, expect, it } from "vitest";
import {
  brokerBuyerShareRate,
  estimateFinancing,
  estimateMonthlyPayment,
  estimatePurchaseCosts,
  formatPercent,
  parseBrokerBuyerRatePercent,
  parseFederalStateCode,
  resolveBrokerBuyerRate,
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

  it("uses project broker rate override", () => {
    const result = estimatePurchaseCosts({
      price: 300_000,
      federalStateCode: "HB",
      brokerInvolved: true,
      brokerBuyerRate: 0.03,
    });
    expect(result.ancillaryTotal).toBe(31_500);
  });
});

describe("parseBrokerBuyerRatePercent", () => {
  it("parses German decimal input", () => {
    expect(parseBrokerBuyerRatePercent("2,975")).toBe(0.02975);
    expect(parseBrokerBuyerRatePercent("")).toBeNull();
  });
});

describe("resolveBrokerBuyerRate", () => {
  it("prefers project rate over state default", () => {
    expect(resolveBrokerBuyerRate("HB", 0.04)).toBe(0.04);
    expect(resolveBrokerBuyerRate("HB", null)).toBe(brokerBuyerShareRate("HB"));
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

describe("estimateMonthlyPayment", () => {
  it("computes annuity for typical loan", () => {
    const monthly = estimateMonthlyPayment(272_500, 0.035, 30);
    expect(monthly).toBeGreaterThan(1200);
    expect(monthly).toBeLessThan(1300);
  });

  it("returns zero for no loan", () => {
    expect(estimateMonthlyPayment(0, 0.035, 30)).toBe(0);
  });
});

describe("estimateFinancing", () => {
  it("derives loan amount and monthly payment", () => {
    const result = estimateFinancing({
      totalCost: 322_500,
      equityAmount: 50_000,
      loanTermYears: 30,
      interestRate: 0.035,
    });
    expect(result?.loanAmount).toBe(272_500);
    expect(result?.monthlyPayment).toBeGreaterThan(0);
  });

  it("uses default interest when omitted", () => {
    const result = estimateFinancing({
      totalCost: 300_000,
      equityAmount: 60_000,
      loanTermYears: 25,
    });
    expect(result?.interestRateIsDefault).toBe(true);
  });
});
