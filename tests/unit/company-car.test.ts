import { describe, expect, it } from "vitest";
import {
  BASE_RATE_MONTHLY,
  COMMUTE_RATE_PER_KM,
  companyCarRateLabel,
  DEFAULT_MARGINAL_TAX_RATE_PERCENT,
  distanceKmOneWay,
  estimateNetLoadEur,
  formatCommuteBenefitEur,
  monthlyBaseBenefitEur,
  monthlyCommuteBenefitEur,
  monthlyCompanyCarBenefitEur,
  parseCompanyCarRate,
  parseListPriceEuros,
  parseMarginalTaxRatePercent,
  resolveMarginalTaxRatePercent,
  roundListPrice,
} from "@/lib/company-car";

describe("roundListPrice", () => {
  it("rounds down to full €100", () => {
    expect(roundListPrice(40750)).toBe(40700);
    expect(roundListPrice(40700)).toBe(40700);
    expect(roundListPrice(99)).toBe(0);
  });
});

describe("distanceKmOneWay", () => {
  it("rounds up meters to full km", () => {
    expect(distanceKmOneWay(24000)).toBe(24);
    expect(distanceKmOneWay(24001)).toBe(25);
    expect(distanceKmOneWay(500)).toBe(1);
  });
});

describe("marginal tax rate", () => {
  it("defaults to 42 percent", () => {
    expect(resolveMarginalTaxRatePercent(null)).toBe(DEFAULT_MARGINAL_TAX_RATE_PERCENT);
    expect(parseMarginalTaxRatePercent("")).toBe(42);
    expect(parseMarginalTaxRatePercent("35")).toBe(35);
  });

  it("estimates net load from gross benefit", () => {
    expect(estimateNetLoadEur(712.25, 42)).toBe(299.15);
  });
});

describe("monthlyBaseBenefitEur", () => {
  it("uses 1% of rounded list price for combustion", () => {
    expect(monthlyBaseBenefitEur({ listPriceEuros: 40750, rate: "standard" })).toBe(407);
  });

  it("uses 0.25% for electric", () => {
    expect(monthlyBaseBenefitEur({ listPriceEuros: 40700, rate: "electric" })).toBe(101.75);
  });
});

describe("monthlyCommuteBenefitEur", () => {
  it("matches driversnote example for standard combustion", () => {
    const monthly = monthlyCommuteBenefitEur({
      listPriceEuros: 40750,
      rate: "standard",
      distanceMeters: 25_000,
    });
    expect(monthly).toBe(305.25);
  });

  it("uses reduced rate for electric vehicles", () => {
    const monthly = monthlyCommuteBenefitEur({
      listPriceEuros: 40700,
      rate: "electric",
      distanceMeters: 25_000,
    });
    expect(monthly).toBe(76.31);
  });

  it("uses hybrid rate", () => {
    const monthly = monthlyCommuteBenefitEur({
      listPriceEuros: 40700,
      rate: "hybrid",
      distanceMeters: 25_000,
    });
    expect(monthly).toBeCloseTo(152.625, 2);
  });
});

describe("monthlyCompanyCarBenefitEur", () => {
  it("combines gross base, commute and net estimate", () => {
    const benefit = monthlyCompanyCarBenefitEur({
      listPriceEuros: 40750,
      rate: "standard",
      distanceMeters: 25_000,
      marginalTaxRatePercent: 42,
    });
    expect(benefit).toEqual({
      baseGrossEur: 407,
      commuteGrossEur: 305.25,
      totalGrossEur: 712.25,
      baseNetEur: 170.94,
      commuteNetEur: 128.2,
      totalNetEur: 299.15,
      marginalTaxRatePercent: 42,
    });
  });
});

describe("parseCompanyCarRate", () => {
  it("defaults to standard for unknown values", () => {
    expect(parseCompanyCarRate("")).toBe("standard");
    expect(parseCompanyCarRate("electric")).toBe("electric");
  });
});

describe("parseListPriceEuros", () => {
  it("parses german and plain numbers", () => {
    expect(parseListPriceEuros("40.700")).toBe(40700);
    expect(parseListPriceEuros("40700")).toBe(40700);
    expect(parseListPriceEuros("")).toBeNull();
  });
});

describe("formatCommuteBenefitEur", () => {
  it("formats with two decimals", () => {
    expect(formatCommuteBenefitEur(305.25)).toMatch(/305,25/);
  });
});

describe("companyCarRateLabel", () => {
  it("labels all rates", () => {
    expect(companyCarRateLabel("standard")).toContain("1 %");
    expect(BASE_RATE_MONTHLY.standard).toBe(0.01);
    expect(COMMUTE_RATE_PER_KM.standard).toBe(0.0003);
  });
});
