import { describe, expect, it } from "vitest";
import type { ApartmentPdfData } from "@/lib/apartment-pdf-data";
import { renderApartmentPdfBuffer } from "@/lib/apartment-pdf-render";

function syntheticPdfData(overrides?: Partial<ApartmentPdfData>): ApartmentPdfData {
  const ratingGroups = Array.from({ length: 3 }, (_, groupIndex) => ({
    groupName: `Group ${groupIndex + 1}`,
    criteria: Array.from({ length: 12 }, (_, criterionIndex) => ({
      criterionId: `c-${groupIndex}-${criterionIndex}`,
      name: `Criterion ${groupIndex + 1}.${criterionIndex + 1}`,
      isDealbreaker: false,
      score: 8,
      note: criterionIndex % 3 === 0 ? "Sample note" : null,
    })),
  }));

  return {
    exportedAt: new Date("2026-05-26T07:23:00.000Z"),
    timeZone: "Europe/Berlin",
    projectName: "Test Project",
    userName: "Test User",
    score: { displayScore: 72, dealbreaker: false, rated: 10, total: 20 },
    apartment: {
      title: "Test Listing",
      address: null,
      listingUrl: null,
      price: 350_000,
      sizeSqm: 120,
      plotSizeSqm: 400,
      floor: null,
      yearBuilt: 1990,
      energyClass: "F",
      brokerInvolved: false,
      hoaFeeMonthly: null,
      heatingCostMonthly: null,
      propertyTaxAnnual: null,
      renovationCost: null,
      coldRentMonthly: null,
      description: "Long description line. ".repeat(8).trim(),
      notes: "Long notes line. ".repeat(6).trim(),
      viewedAt: null,
      archivedAt: null,
    },
    purchaseCosts: null,
    acquisitionTotal: 380_000,
    finance: {
      equityAmount: 80_000,
      loanTermYears: 25,
      interestRate: 0.035,
      netHouseholdIncome: 5_000,
      monthlyFixedCosts: 1_200,
    },
    ratingGroups,
    commutePeople: [
      {
        userId: "u1",
        name: "Member A",
        travelMode: "transit",
        legs: [
          {
            addressId: "a1",
            label: "Destination",
            durationText: "47 Min.",
            distanceText: "714 m",
            connectionSummary: "55 · N1",
            effectiveMode: "transit",
          },
        ],
      },
    ],
    viewings: [
      { scheduledAt: new Date("2026-05-22T15:30:00.000Z"), note: "Besichtigung" },
    ],
    priceHistory: [],
    boris: {
      status: "ok",
      fetchedAt: new Date("2026-05-20T12:00:00.000Z"),
      errorMessage: null,
      results: [
        {
          kategorieLabel: "Wohnbaufläche",
          brwEurPerSqm: 620,
          nutzungsartLabel: "Wohnbaufläche (W)",
          stichtag: "2025-01-01",
        },
      ],
    },
    locationInsights: {
      environment: [],
      noise: [],
      flood: [],
    },
    ...overrides,
  };
}

describe.each(["full", "bank"] as const)("renderApartmentPdfBuffer (%s)", (variant) => {
  it("renders a valid PDF buffer", async () => {
    const buffer = await renderApartmentPdfBuffer(syntheticPdfData(), { variant });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  }, 30_000);
});

describe("renderApartmentPdfBuffer (bank)", () => {
  it("renders without finance settings", async () => {
    const data = syntheticPdfData({
      finance: {
        equityAmount: null,
        loanTermYears: null,
        interestRate: null,
        netHouseholdIncome: null,
        monthlyFixedCosts: null,
      },
    });
    const buffer = await renderApartmentPdfBuffer(data, { variant: "bank" });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  }, 30_000);

  it("renders when BORIS data is unavailable", async () => {
    const data = syntheticPdfData({
      boris: {
        status: "no_data",
        fetchedAt: new Date("2026-05-20T12:00:00.000Z"),
        errorMessage: null,
        results: [],
      },
    });
    const buffer = await renderApartmentPdfBuffer(data, { variant: "bank" });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  }, 30_000);
});
