import { describe, expect, it } from "vitest";
import {
  formatCommuteReindexMessage,
  formatDocumentsReindexMessage,
} from "@/lib/project-reindex-messages";

describe("formatDocumentsReindexMessage", () => {
  it("reports empty projects", () => {
    expect(
      formatDocumentsReindexMessage({
        processed: 0,
        withText: 0,
        withoutText: 0,
        missingFile: 0,
      })
    ).toBe("Keine PDFs in diesem Projekt.");
  });

  it("summarizes processed PDFs", () => {
    expect(
      formatDocumentsReindexMessage({
        processed: 3,
        withText: 2,
        withoutText: 1,
        missingFile: 0,
      })
    ).toBe("3 PDF(s) verarbeitet: 2 mit Text, 1 ohne Textlayer.");
  });
});

describe("formatCommuteReindexMessage", () => {
  it("reports empty projects", () => {
    expect(
      formatCommuteReindexMessage({
        apartmentsTotal: 0,
        apartmentsWithCoords: 0,
        routesComputed: 0,
        routesSkipped: 0,
        routesFailed: 0,
        routesApiUnavailable: 0,
      })
    ).toBe("Keine aktiven Immobilien in diesem Projekt.");
  });

  it("summarizes computed routes", () => {
    expect(
      formatCommuteReindexMessage({
        apartmentsTotal: 2,
        apartmentsWithCoords: 2,
        routesComputed: 4,
        routesSkipped: 1,
        routesFailed: 0,
        routesApiUnavailable: 0,
      })
    ).toBe(
      "4 Route(n) berechnet (2 von 2 Immobilie(n) mit Koordinaten), 1 übersprungen."
    );
  });

  it("reports API unavailability separately", () => {
    expect(
      formatCommuteReindexMessage({
        apartmentsTotal: 1,
        apartmentsWithCoords: 1,
        routesComputed: 2,
        routesSkipped: 0,
        routesFailed: 0,
        routesApiUnavailable: 3,
      })
    ).toContain("3 wegen API-Ausfall");
  });
});
