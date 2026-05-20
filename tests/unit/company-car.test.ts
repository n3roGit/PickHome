import { describe, expect, it } from "vitest";
import {
  BASE_RATE_MONTHLY,
  COMMUTE_RATE_PER_KM,
  COMMUTE_RATE_PER_TRIP_KM,
  companyCarRateLabel,
  DEFAULT_MARGINAL_TAX_RATE_PERCENT,
  distanceKmOneWay,
  estimateNetLoadEur,
  formatCommuteBenefitEur,
  marginalTaxRateOptionLabel,
  MARGINAL_TAX_RATE_OPTIONS,
  monthlyBaseBenefitEur,
  monthlyCommuteBenefitEur,
  monthlyCompanyCarBenefitEur,
  monthlyCompanyCarDeductionsEur,
  parseCompanyCarRate,
  parseListPriceEuros,
  parseMarginalTaxRatePercent,
  parseOfficeTripsPerMonth,
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

  it("labels tax rate options with income guidance", () => {
    expect(marginalTaxRateOptionLabel(MARGINAL_TAX_RATE_OPTIONS[3])).toContain("68.000");
    expect(marginalTaxRateOptionLabel(MARGINAL_TAX_RATE_OPTIONS[4])).toContain("278.000");
  });
});

describe("monthlyBaseBenefitEur", () => {
  it("uses 1% of rounded list price for combustion", () => {
    expect(monthlyBaseBenefitEur({ listPriceEuros: 40750, rate: "standard" })).toBe(407);
  });

  it("uses 0.25% for electric up to list price cap", () => {
    expect(monthlyBaseBenefitEur({ listPriceEuros: 40700, rate: "electric" })).toBe(101.75);
  });

  it("uses halved rates for electric above list price cap", () => {
    expect(monthlyBaseBenefitEur({ listPriceEuros: 120_000, rate: "electric" })).toBe(600);
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

  it("uses trip method for few office days", () => {
    const monthly = monthlyCommuteBenefitEur({
      listPriceEuros: 50_000,
      rate: "standard",
      distanceMeters: 20_000,
      commuteMethod: "trips",
      officeTripsPerMonth: 8,
    });
    expect(monthly).toBe(160);
    expect(COMMUTE_RATE_PER_TRIP_KM.standard).toBe(0.00002);
  });

  it("uses reduced rate for electric vehicles", () => {
    const monthly = monthlyCommuteBenefitEur({
      listPriceEuros: 40700,
      rate: "electric",
      distanceMeters: 25_000,
    });
    expect(monthly).toBe(76.31);
  });
});

describe("monthlyCompanyCarDeductionsEur", () => {
  it("subtracts contribution and self-paid costs without employer fuel card", () => {
    expect(
      monthlyCompanyCarDeductionsEur({
        contributionEur: 150,
        selfPaidCostsEur: 80,
        employerFuelCard: false,
      })
    ).toBe(230);
  });

  it("ignores self-paid costs when employer pays fuel", () => {
    expect(
      monthlyCompanyCarDeductionsEur({
        contributionEur: 150,
        selfPaidCostsEur: 80,
        employerFuelCard: true,
      })
    ).toBe(150);
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
      deductionsEur: 0,
      totalGrossEur: 712.25,
      baseNetEur: 170.94,
      commuteNetEur: 128.2,
      totalNetEur: 299.15,
      marginalTaxRatePercent: 42,
      commuteMethod: "distance",
      officeTripsPerMonth: null,
      employerFuelCard: true,
    });
  });

  it("applies deductions to total gross benefit", () => {
    const benefit = monthlyCompanyCarBenefitEur({
      listPriceEuros: 50_000,
      rate: "standard",
      distanceMeters: 20_000,
      commuteMethod: "trips",
      officeTripsPerMonth: 8,
      contributionEur: 100,
      selfPaidCostsEur: 50,
      employerFuelCard: false,
      marginalTaxRatePercent: 45,
    });
    expect(benefit?.baseGrossEur).toBe(500);
    expect(benefit?.commuteGrossEur).toBe(160);
    expect(benefit?.deductionsEur).toBe(150);
    expect(benefit?.totalGrossEur).toBe(510);
    expect(benefit?.totalNetEur).toBe(229.5);
  });

  it("requires office trips for trip method", () => {
    expect(
      monthlyCompanyCarBenefitEur({
        listPriceEuros: 50_000,
        rate: "standard",
        distanceMeters: 20_000,
        commuteMethod: "trips",
        officeTripsPerMonth: null,
      })
    ).toBeNull();
  });
});

describe("parseOfficeTripsPerMonth", () => {
  it("parses valid trip counts", () => {
    expect(parseOfficeTripsPerMonth("8")).toBe(8);
    expect(parseOfficeTripsPerMonth("")).toBeNull();
    expect(parseOfficeTripsPerMonth("0")).toBeNull();
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
