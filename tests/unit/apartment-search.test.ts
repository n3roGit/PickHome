import { describe, expect, it } from "vitest";
import {
  buildApartmentSearchBlob,
  filterApartmentsBySearch,
  matchesApartmentSearch,
} from "@/lib/apartment-search";

const criteria = new Map([["c1", "Lage"]]);

const sample = {
  title: "Altbau Mitte",
  address: "Hauptstraße 1",
  description: "Renoviert 2020",
  notes: "Verhandlung möglich",
  yearBuilt: 1910,
  ratings: [{ criterionId: "c1", score: 8, note: "ruhige Seitenstraße" }],
  viewings: [{ scheduledAt: new Date("2026-05-22T14:00:00"), note: "mit Makler" }],
  documents: [{ fileName: "expose.pdf" }],
  photos: [{ caption: "Wohnzimmer" }],
};

describe("apartment search", () => {
  it("finds text in description and notes", () => {
    const blob = buildApartmentSearchBlob(sample, criteria);
    expect(matchesApartmentSearch(blob, "renoviert")).toBe(true);
    expect(matchesApartmentSearch(blob, "verhandlung")).toBe(true);
    expect(matchesApartmentSearch(blob, "ruhige")).toBe(true);
    expect(matchesApartmentSearch(blob, "expose")).toBe(true);
  });

  it("finds text in uploaded PDF extract", () => {
    const blob = buildApartmentSearchBlob(
      {
        ...sample,
        documents: [{ fileName: "expose.pdf", extractedText: "Energieklasse B Gasheizung 1998" }],
      },
      criteria
    );
    expect(matchesApartmentSearch(blob, "energieklasse")).toBe(true);
    expect(matchesApartmentSearch(blob, "gasheizung")).toBe(true);
  });

  it("requires all tokens", () => {
    const blob = buildApartmentSearchBlob(sample, criteria);
    expect(matchesApartmentSearch(blob, "altbau mitte")).toBe(true);
    expect(matchesApartmentSearch(blob, "altbau fehlt")).toBe(false);
  });

  it("finds numeric fields like year built", () => {
    const blob = buildApartmentSearchBlob(sample, criteria);
    expect(matchesApartmentSearch(blob, "1910")).toBe(true);
  });

  it("filters apartment list", () => {
    const filtered = filterApartmentsBySearch(
      [sample, { title: "Neubau", ratings: [] }],
      "1910",
      criteria
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Altbau Mitte");
  });
});
