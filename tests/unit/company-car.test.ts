import { describe, expect, it } from "vitest";
import {
  COMMUTE_RATE_PER_KM,
  companyCarRateLabel,
  distanceKmOneWay,
  formatCommuteBenefitEur,
  monthlyCommuteBenefitEur,
  parseCompanyCarRate,
  parseListPriceEuros,
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
    expect(companyCarRateLabel("standard")).toContain("0,03");
    expect(COMMUTE_RATE_PER_KM.standard).toBe(0.0003);
  });
});
