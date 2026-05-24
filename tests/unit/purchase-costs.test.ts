import { describe, expect, it } from "vitest";
import {
  apartmentMonthlyMaintenance,
  estimatePropertyTaxAnnual,
  resolvePropertyTaxAnnual,
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
  resolveFederalStateCode,
  totalAcquisitionCost,
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
    expect(result?.totalLoanPayments).toBe(result!.monthlyPayment * 30 * 12);
    expect(result?.totalInterest).toBe(result!.totalLoanPayments - 272_500);
    expect(result?.lifetimeTotal).toBe(50_000 + result!.totalLoanPayments);
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
  it("flags rate share above 35 percent as caution", () => {
    const result = estimateAffordability({
      monthlyPayment: 2_000,
      netHouseholdIncome: 5_000,
    });
    expect(result?.rateShare).toBe(0.4);
    expect(result?.rateLevel).toBe("caution");
    expect(result?.burdenShare).toBe(0.4);
    expect(result?.level).toBe("caution");
  });

  it("marks affordable rate share as ok", () => {
    const result = estimateAffordability({
      monthlyPayment: 1_500,
      netHouseholdIncome: 5_000,
    });
    expect(result?.rateLevel).toBe("ok");
    expect(result?.level).toBe("ok");
  });

  it("flags housing share when maintenance pushes housing above 40 percent", () => {
    const result = estimateAffordability({
      monthlyPayment: 1_500,
      netHouseholdIncome: 5_000,
      monthlyMaintenance: 501,
    });
    expect(result?.totalMonthlyBurden).toBe(2_001);
    expect(result?.housingShare).toBeCloseTo(0.4002);
    expect(result?.housingLevel).toBe("caution");
    expect(result?.rateLevel).toBe("ok");
    expect(result?.burdenShare).toBe(0.3);
  });

  it("includes fixed costs in total burden and remaining monthly", () => {
    const result = estimateAffordability({
      monthlyPayment: 1_000,
      netHouseholdIncome: 4_000,
      monthlyMaintenance: 400,
      monthlyFixedCosts: 800,
    });
    expect(result?.totalMonthlyBurden).toBe(2_200);
    expect(result?.remainingMonthly).toBe(1_800);
    expect(result?.monthlyFixedCosts).toBe(800);
    expect(result?.fixedCostsConfigured).toBe(true);
    expect(result?.rateLevel).toBe("ok");
    expect(result?.remainingLevel).toBe("ok");
    expect(result?.burdenShare).toBe(0.25);
  });

  it("flags remaining caution when fixed costs leave less than 10 percent buffer", () => {
    const result = estimateAffordability({
      monthlyPayment: 1_500,
      netHouseholdIncome: 4_000,
      monthlyMaintenance: 400,
      monthlyFixedCosts: 1_710,
    });
    expect(result?.remainingMonthly).toBe(390);
    expect(result?.remainingLevel).toBe("caution");
    expect(result?.rateLevel).toBe("caution");
  });

  it("flags remaining warn when expenses exceed net income", () => {
    const result = estimateAffordability({
      monthlyPayment: 3_000,
      netHouseholdIncome: 4_000,
      monthlyMaintenance: 400,
      monthlyFixedCosts: 800,
    });
    expect(result?.remainingMonthly).toBeLessThan(0);
    expect(result?.remainingLevel).toBe("warn");
  });

  it("skips remaining alarm when fixed costs are not configured", () => {
    const result = estimateAffordability({
      monthlyPayment: 1_000,
      netHouseholdIncome: 4_000,
      monthlyMaintenance: 400,
      monthlyFixedCosts: null,
    });
    expect(result?.fixedCostsConfigured).toBe(false);
    expect(result?.monthlyFixedCosts).toBe(0);
    expect(result?.totalMonthlyBurden).toBe(1_400);
    expect(result?.remainingMonthly).toBe(2_600);
    expect(result?.remainingLevel).toBe("ok");
  });
});

describe("estimatePropertyTaxAnnual", () => {
  it("returns null without price", () => {
    expect(estimatePropertyTaxAnnual({ price: null, plotSizeSqm: 500 })).toBeNull();
  });

  it("scales up slightly for large plot vs living area", () => {
    const base = estimatePropertyTaxAnnual({ price: 400_000, sizeSqm: 100, plotSizeSqm: 100 });
    const largePlot = estimatePropertyTaxAnnual({
      price: 400_000,
      sizeSqm: 100,
      plotSizeSqm: 600,
    });
    expect(base).not.toBeNull();
    expect(largePlot).not.toBeNull();
    expect(largePlot!).toBeGreaterThan(base!);
  });
});

describe("resolvePropertyTaxAnnual", () => {
  it("prefers stored value over estimate", () => {
    expect(
      resolvePropertyTaxAnnual({
        propertyTaxAnnual: 900,
        price: 300_000,
        plotSizeSqm: 500,
      })
    ).toEqual({ annual: 900, isEstimate: false });
  });

  it("estimates when annual tax missing", () => {
    const r = resolvePropertyTaxAnnual({ price: 300_000, plotSizeSqm: 400 });
    expect(r.isEstimate).toBe(true);
    expect(r.annual).toBeGreaterThan(0);
  });
});

describe("apartmentMonthlyMaintenance", () => {
  it("sums hoa, heating, and monthly property tax", () => {
    expect(
      apartmentMonthlyMaintenance({
        hoaFeeMonthly: 200,
        heatingCostMonthly: 100,
        propertyTaxAnnual: 600,
      })
    ).toBe(350);
  });

  it("uses estimated property tax from plot and price when annual missing", () => {
    const monthly = apartmentMonthlyMaintenance({
      hoaFeeMonthly: 0,
      heatingCostMonthly: 0,
      price: 500_000,
      plotSizeSqm: 800,
      sizeSqm: 120,
    });
    expect(monthly).toBeGreaterThan(0);
  });
});

describe("totalAcquisitionCost", () => {
  it("adds renovation to purchase total", () => {
    const purchase = estimatePurchaseCosts({
      price: 300_000,
      federalStateCode: "HB",
      brokerInvolved: false,
    });
    expect(totalAcquisitionCost(purchase, 25_000)).toBe(347_500);
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
    monthlyFixedCosts: null,
  };

  it("computes costs and monthly burden", () => {
    const result = apartmentCompareMetrics(
      { price: 300_000, sizeSqm: 100, brokerInvolved: true, address: null },
      finance
    );
    expect(result.totalCost).toBe(331_425);
    expect(result.monthlyPayment).toBeGreaterThan(0);
    expect(result.totalMonthlyBurden).not.toBeNull();
    expect(result.burdenShare).not.toBeNull();
    expect(result.burdenLevel).toBeTruthy();
  });

  it("includes fixed costs in compare totalMonthlyBurden", () => {
    const result = apartmentCompareMetrics(
      { price: 300_000, sizeSqm: 100, brokerInvolved: false, address: null },
      { ...finance, monthlyFixedCosts: 1_000 }
    );
    expect(result.totalMonthlyBurden).toBeGreaterThan(result.monthlyPayment!);
  });

  it("uses rate share only for burdenShare, not maintenance", () => {
    const withoutMaint = apartmentCompareMetrics(
      {
        price: 300_000,
        sizeSqm: 100,
        brokerInvolved: true,
        address: null,
      },
      finance
    );
    const withMaint = apartmentCompareMetrics(
      {
        price: 300_000,
        sizeSqm: 100,
        brokerInvolved: true,
        address: null,
        hoaFeeMonthly: 400,
        heatingCostMonthly: 200,
      },
      finance
    );
    expect(withMaint.burdenShare).toBe(withoutMaint.burdenShare);
    expect(withMaint.totalMonthlyBurden!).toBeGreaterThan(withoutMaint.totalMonthlyBurden!);
  });

  it("includes renovation in total cost", () => {
    const result = apartmentCompareMetrics(
      {
        price: 300_000,
        sizeSqm: null,
        brokerInvolved: false,
        address: null,
        renovationCost: 20_000,
      },
      { ...finance, equityAmount: null, loanTermYears: null }
    );
    expect(result.totalCost).toBe(342_500);
  });

  it("uses address Bundesland instead of project default", () => {
    const result = apartmentCompareMetrics(
      { price: 300_000, sizeSqm: null, brokerInvolved: false, address: "80331 München" },
      { ...finance, federalStateCode: "HB" }
    );
    expect(result.totalCost).toBe(316_500);
  });

  it("returns partial metrics without finance settings", () => {
    const result = apartmentCompareMetrics(
      { price: 300_000, sizeSqm: null, brokerInvolved: false, address: null },
      { ...finance, equityAmount: null, loanTermYears: null }
    );
    expect(result.totalCost).toBe(322_500);
    expect(result.monthlyPayment).toBeNull();
  });
});
