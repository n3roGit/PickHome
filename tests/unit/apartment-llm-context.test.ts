import { describe, expect, it } from "vitest";
import {
  apartmentLlmHasSourceText,
  buildApartmentLlmContext,
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
});
