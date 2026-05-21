import { describe, expect, it } from "vitest";
import {
  annualCommuterAllowanceEur,
  annualCommuterTaxBenefitEur,
  commuteKmOneWayForAllowance,
  commuterAllowanceBreakdown,
  dailyCommuterAllowanceEur,
  DEFAULT_COMMUTE_DAYS_PER_YEAR,
  resolveCommuteDaysPerYear,
  WERBUNGSKOSTEN_PAUSCHALE_EUR,
} from "@/lib/commuter-allowance";

describe("commuteKmOneWayForAllowance", () => {
  it("rounds down meters to full km", () => {
    expect(commuteKmOneWayForAllowance(2680)).toBe(2);
    expect(commuteKmOneWayForAllowance(2999)).toBe(2);
    expect(commuteKmOneWayForAllowance(3000)).toBe(3);
  });
});

describe("dailyCommuterAllowanceEur", () => {
  it("uses 0.30 and 0.38 tiers in 2025", () => {
    expect(dailyCommuterAllowanceEur(3, 2025)).toBe(0.9);
    expect(dailyCommuterAllowanceEur(20, 2025)).toBe(6);
    expect(dailyCommuterAllowanceEur(26, 2025)).toBe(8.28);
  });

  it("uses uniform 0.38 from 2026", () => {
    expect(dailyCommuterAllowanceEur(3, 2026)).toBe(1.14);
    expect(dailyCommuterAllowanceEur(26, 2026)).toBe(9.88);
  });
});

describe("resolveCommuteDaysPerYear", () => {
  it("prefers explicit days", () => {
    expect(
      resolveCommuteDaysPerYear({
        daysPerYear: 180,
        officeTripsPerMonth: 20,
        vacationDays: null,
        sickDays: null,
        homeOfficeDays: null,
      })
    ).toEqual({ days: 180, source: "explicit" });
  });

  it("derives from office trips per month", () => {
    expect(
      resolveCommuteDaysPerYear({
        daysPerYear: null,
        officeTripsPerMonth: 8,
        vacationDays: null,
        sickDays: null,
        homeOfficeDays: null,
      })
    ).toEqual({ days: 96, source: "trips" });
  });

  it("uses calendar subtraction with defaults", () => {
    expect(
      resolveCommuteDaysPerYear({
        daysPerYear: null,
        officeTripsPerMonth: null,
        vacationDays: null,
        sickDays: null,
        homeOfficeDays: null,
      })
    ).toEqual({ days: 221, source: "calendar" });
  });
});

describe("annualCommuterTaxBenefitEur", () => {
  it("returns zero when allowance is below Werbungskosten-Pauschale", () => {
    expect(annualCommuterTaxBenefitEur(198, 42)).toBe(0);
    expect(annualCommuterTaxBenefitEur(WERBUNGSKOSTEN_PAUSCHALE_EUR, 42)).toBe(0);
  });

  it("applies marginal rate only to amount above pauschale", () => {
    expect(annualCommuterTaxBenefitEur(1357.92, 42)).toBeCloseTo(53.73, 2);
  });
});

describe("commuterAllowanceBreakdown", () => {
  it("matches drivers-check example for 26 km and 164 days in 2025", () => {
    const result = commuterAllowanceBreakdown({
      distanceMeters: 26_800,
      settings: {
        daysPerYear: 164,
        vacationDays: null,
        sickDays: null,
        homeOfficeDays: null,
        officeTripsPerMonth: null,
      },
      marginalTaxRatePercent: 42,
      year: 2025,
    });
    expect(result?.kmOneWay).toBe(26);
    expect(result?.dailyAllowanceEur).toBe(8.28);
    expect(result?.annualAllowanceEur).toBe(1357.92);
    expect(result?.annualTaxBenefitEur).toBeCloseTo(53.73, 2);
  });

  it("defaults to calendar days when no explicit input", () => {
    const annual = annualCommuterAllowanceEur({
      distanceMeters: 3000,
      settings: {
        daysPerYear: null,
        officeTripsPerMonth: null,
        vacationDays: null,
        sickDays: null,
        homeOfficeDays: null,
      },
      year: 2025,
    });
    expect(annual?.daysPerYear).toBe(221);
    expect(DEFAULT_COMMUTE_DAYS_PER_YEAR).toBe(220);
  });
});
