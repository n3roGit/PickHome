import { describe, expect, it } from "vitest";
import { buildApartmentFinanceLlmSection } from "@/lib/apartment-llm-finance-context";
import { TEST_ADDRESS_BERLIN_RAW } from "../helpers/synthetic-addresses";

describe("buildApartmentFinanceLlmSection", () => {
  const finance = {
    federalStateCode: "BE",
    brokerBuyerRate: null,
    equityAmount: 50_000,
    loanTermYears: 30,
    interestRate: null,
    netHouseholdIncome: 3_500,
    monthlyFixedCosts: 1_200,
  };

  it("includes disclaimer and fixed costs in total burden", () => {
    const section = buildApartmentFinanceLlmSection(
      {
        price: 250_000,
        address: TEST_ADDRESS_BERLIN_RAW,
        brokerInvolved: false,
        hoaFeeMonthly: 300,
        heatingCostMonthly: 150,
        propertyTaxAnnual: null,
        renovationCost: null,
        sizeSqm: 80,
        plotSizeSqm: null,
      },
      finance
    );
    expect(section).toContain("Finanz-Schätzung (PickHome");
    expect(section).toContain("keine verbindliche Kalkulation");
    expect(section).toContain("Fixkosten Lebenshaltung");
    expect(section).toContain("Gesamtbelastung/Monat");
    expect(section).toContain("Rest nach allen Kosten");
    expect(section).toContain("Standard-Zins");
  });

  it("lists missing data when price or state unavailable", () => {
    const section = buildApartmentFinanceLlmSection(
      {
        price: null,
        address: null,
        brokerInvolved: false,
        hoaFeeMonthly: null,
        heatingCostMonthly: null,
        propertyTaxAnnual: null,
        renovationCost: null,
        sizeSqm: null,
        plotSizeSqm: null,
      },
      {
        federalStateCode: null,
        brokerBuyerRate: null,
        equityAmount: null,
        loanTermYears: null,
        interestRate: null,
        netHouseholdIncome: null,
        monthlyFixedCosts: null,
      }
    );
    expect(section).toContain("Fehlende Daten");
    expect(section).toContain("Kaufpreis fehlt");
    expect(section).toContain("Bundesland nicht ableitbar");
  });
});
