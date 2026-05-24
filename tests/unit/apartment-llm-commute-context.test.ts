import { describe, expect, it } from "vitest";
import { buildApartmentCommuteLlmSection } from "@/lib/apartment-llm-commute-context";
import type { CommutePersonEstimate } from "@/lib/commute";

describe("buildApartmentCommuteLlmSection", () => {
  it("returns empty string without people", () => {
    expect(buildApartmentCommuteLlmSection([])).toBe("");
  });

  it("formats legs and unavailable reasons", () => {
    const people: CommutePersonEstimate[] = [
      {
        userId: "u1",
        name: "Alex",
        isCurrentUser: true,
        travelMode: "driving",
        legs: [
          {
            addressId: "a1",
            label: "Büro",
            address: "Test Address",
            distanceText: "12,4 km",
            durationText: "28 Min",
            connectionSummary: null,
            transitDetailTooltip: null,
            routeKind: null,
            effectiveMode: null,
            routingNote: null,
            unavailableReason: null,
            distanceKmOneWay: 12.4,
            monthlyCompanyCarBaseBenefitEur: null,
            monthlyCompanyCarCommuteBenefitEur: null,
            monthlyCompanyCarTotalBenefitEur: null,
            monthlyCompanyCarTotalNetBenefitEur: null,
            monthlyCompanyCarDeductionsEur: null,
            companyCarMarginalTaxRatePercent: null,
            companyCarCommuteMethod: null,
            companyCarOfficeTripsPerMonth: null,
            companyCarEmployerFuelCard: null,
            annualCommuterAllowanceEur: null,
            annualCommuterTaxBenefitEur: null,
            commuterAllowanceDaysPerYear: null,
            commuterAllowanceKmOneWay: null,
            commuterAllowanceDaysSource: null,
            commuteCostHint: null,
          },
        ],
      },
      {
        userId: "u2",
        name: "Sam",
        isCurrentUser: false,
        travelMode: "transit",
        legs: [
          {
            addressId: "a2",
            label: "Arbeit",
            address: "Other Address",
            distanceText: null,
            durationText: null,
            connectionSummary: null,
            transitDetailTooltip: null,
            routeKind: null,
            effectiveMode: null,
            routingNote: null,
            unavailableReason: "missing_apartment_coords",
            distanceKmOneWay: null,
            monthlyCompanyCarBaseBenefitEur: null,
            monthlyCompanyCarCommuteBenefitEur: null,
            monthlyCompanyCarTotalBenefitEur: null,
            monthlyCompanyCarTotalNetBenefitEur: null,
            monthlyCompanyCarDeductionsEur: null,
            companyCarMarginalTaxRatePercent: null,
            companyCarCommuteMethod: null,
            companyCarOfficeTripsPerMonth: null,
            companyCarEmployerFuelCard: null,
            annualCommuterAllowanceEur: null,
            annualCommuterTaxBenefitEur: null,
            commuterAllowanceDaysPerYear: null,
            commuterAllowanceKmOneWay: null,
            commuterAllowanceDaysSource: null,
            commuteCostHint: null,
          },
        ],
      },
    ];

    const section = buildApartmentCommuteLlmSection(people);
    expect(section).toContain("Fahrtwege (PickHome-Schätzung");
    expect(section).toContain("Alex (Auto)");
    expect(section).toContain("ca. 28 Min");
    expect(section).toContain("Sam (ÖPNV)");
    expect(section).toContain("Koordinaten");
    expect(section).not.toContain("transitDetailJson");
  });
});
