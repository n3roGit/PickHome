import { describe, expect, it } from "vitest";
import {
  apartmentLlmHasSourceText,
  buildApartmentLlmContext,
  buildApartmentListingExtractSupplement,
} from "@/lib/apartment-llm-context";
import { TEST_ADDRESS_BERLIN_RAW } from "../helpers/synthetic-addresses";

describe("apartmentLlmHasSourceText", () => {
  it("is false without text sources", () => {
    expect(
      apartmentLlmHasSourceText({
        projectName: "P",
        title: "T",
      })
    ).toBe(false);
  });

  it("is true with structured Stammdaten", () => {
    expect(
      apartmentLlmHasSourceText({
        projectName: "P",
        title: "T",
        address: TEST_ADDRESS_BERLIN_RAW,
        price: 1000,
      })
    ).toBe(true);
  });

  it("is true with document text", () => {
    expect(
      apartmentLlmHasSourceText({
        projectName: "P",
        title: "T",
        documents: [{ fileName: "expose.pdf", extractedText: "Heizung: Gas" }],
      })
    ).toBe(true);
  });
});

describe("buildApartmentLlmContext", () => {
  it("includes structured fields and document excerpt", () => {
    const ctx = buildApartmentLlmContext({
      projectName: "Suche",
      title: "Testwohnung",
      address: TEST_ADDRESS_BERLIN_RAW,
      price: 250000,
      documents: [{ fileName: "a.pdf", extractedText: "Hausgeld 200 Euro" }],
    });
    expect(ctx).toContain("Projekt: Suche");
    expect(ctx).toContain("Hausgeld 200 Euro");
    expect(ctx).toContain("a.pdf");
  });

  it("includes monthly and renovation cost fields", () => {
    const ctx = buildApartmentLlmContext({
      projectName: "P",
      title: "T",
      address: TEST_ADDRESS_BERLIN_RAW,
      price: 100_000,
      hoaFeeMonthly: 350,
      renovationCost: 40_000,
      plotSizeSqm: 420,
    });
    expect(ctx).toContain("Hausgeld monatlich");
    expect(ctx).toContain("Renovierung (eingetragen)");
    expect(ctx).toContain("Grundstücksfläche m²: 420");
  });

  it("includes finance, commute, and checklist sections in order", () => {
    const ctx = buildApartmentLlmContext({
      projectName: "P",
      title: "T",
      address: TEST_ADDRESS_BERLIN_RAW,
      price: 100_000,
      financeSection: "--- Finanz-Schätzung (PickHome, grobe Orientierung - keine verbindliche Kalkulation) ---",
      commuteSection: "--- Fahrtwege (PickHome-Schätzung - Verkehr und ÖPNV können abweichen) ---",
      checklistLines: ["- [Technik] Dach: nicht OK"],
      description: "Beschreibungstext",
    });
    const financeIdx = ctx.indexOf("Finanz-Schätzung");
    const commuteIdx = ctx.indexOf("Fahrtwege (PickHome-Schätzung");
    const descIdx = ctx.indexOf("Beschreibung:");
    const checklistIdx = ctx.indexOf("Checkliste (PickHome)");
    expect(financeIdx).toBeGreaterThan(-1);
    expect(commuteIdx).toBeGreaterThan(financeIdx);
    expect(descIdx).toBeGreaterThan(commuteIdx);
    expect(checklistIdx).toBeGreaterThan(descIdx);
  });
});

describe("buildApartmentListingExtractSupplement", () => {
  it("includes saved notes and checklist without PDF bodies when omitted", () => {
    const ctx = buildApartmentListingExtractSupplement(
      {
        projectName: "P",
        title: "T",
        notes: "Dach undicht",
        documents: [{ fileName: "expose.pdf", extractedText: "should be omitted" }],
      },
      {
        omitDocumentBodies: true,
        checklistLines: ["- [Technik] Dach: nicht OK — Notiz: undicht"],
      }
    );
    expect(ctx).toContain("PickHome erfasst");
    expect(ctx).toContain("Dach undicht");
    expect(ctx).toContain("Checkliste:");
    expect(ctx).not.toContain("should be omitted");
  });

  it("narrativeOnly omits structured Stammdaten but keeps notes", () => {
    const ctx = buildApartmentListingExtractSupplement(
      {
        projectName: "P",
        title: "T",
        address: "Exampleweg 1",
        price: 500_000,
        sizeSqm: 90,
        notes: "Dach undicht",
      },
      { narrativeOnly: true, omitDocumentBodies: true }
    );
    expect(ctx).toContain("Freitext");
    expect(ctx).toContain("Dach undicht");
    expect(ctx).not.toContain("500");
    expect(ctx).not.toContain("Exampleweg");
  });
});
