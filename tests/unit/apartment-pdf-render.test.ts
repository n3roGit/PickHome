import { describe, expect, it } from "vitest";
import type { ApartmentPdfData } from "@/lib/apartment-pdf-data";
import { renderApartmentPdfBuffer } from "@/lib/apartment-pdf-render";

function syntheticPdfData(): ApartmentPdfData {
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
      description: "Long description line. ".repeat(8).trim(),
      notes: "Long notes line. ".repeat(6).trim(),
      viewedAt: null,
      archivedAt: null,
    },
    purchaseCosts: null,
    acquisitionTotal: null,
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
  };
}

describe("renderApartmentPdfBuffer", () => {
  it("renders a multi-section PDF buffer", async () => {
    const buffer = await renderApartmentPdfBuffer(syntheticPdfData());
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  }, 30_000);
});
