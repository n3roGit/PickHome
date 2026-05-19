import { describe, expect, it } from "vitest";
import {
  brokerBuyerShareRate,
  estimateAffordability,
  apartmentCompareMetrics,
  estimateFinancing,
  estimateMonthlyPayment,
  estimatePurchaseCosts,
  formatBurdenShare,
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

describe("estimateAffordability", () => {
  it("flags burden above 35 percent", () => {
    const result = estimateAffordability({
      monthlyPayment: 2_000,
      netHouseholdIncome: 5_000,
    });
    expect(result?.burdenShare).toBe(0.4);
    expect(result?.level).toBe("warn");
  });

  it("marks affordable burden as ok", () => {
    const result = estimateAffordability({
      monthlyPayment: 1_500,
      netHouseholdIncome: 5_000,
    });
    expect(result?.level).toBe("ok");
  });
});

describe("formatBurdenShare", () => {
  it("formats share as German percent", () => {
    expect(formatBurdenShare(0.325)).toBe("32,5 %");
  });
});

describe("apartmentCompareMetrics", () => {
  const finance = {
    federalStateCode: "HB",
    brokerBuyerRate: null,
    equityAmount: 50_000,
    loanTermYears: 30,
    interestRate: 0.035,
    netHouseholdIncome: 5_000,
  };

  it("computes costs and monthly burden", () => {
    const result = apartmentCompareMetrics(
      { price: 300_000, sizeSqm: 100, brokerInvolved: true },
      finance
    );
    expect(result.totalCost).toBe(331_425);
    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.burdenShare).toBeGreaterThan(0);
  });

  it("returns partial metrics without finance settings", () => {
    const result = apartmentCompareMetrics(
      { price: 300_000, sizeSqm: null, brokerInvolved: false },
      { ...finance, equityAmount: null, loanTermYears: null }
    );
    expect(result.totalCost).toBe(322_500);
    expect(result.monthlyPayment).toBeNull();
  });
});
