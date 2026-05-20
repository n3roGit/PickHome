import { describe, expect, it } from "vitest";
import { parseListingHtml, parseEnergyClassInput, parseSqmFromText } from "@/lib/listing-import";

describe("listing-import", () => {
  it("parses JSON-LD listing fields", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Apartment",
        "name": "Schöne 3-Zimmer-Wohnung",
        "address": { "streetAddress": "Hauptstr. 1", "postalCode": "28195", "addressLocality": "Bremen" },
        "offers": { "price": 320000 },
        "floorSize": 82
      }
      </script>
    `;
    const fields = parseListingHtml(html);
    expect(fields.title).toContain("3-Zimmer");
    expect(fields.price).toBe(320000);
    expect(fields.sizeSqm).toBe(82);
    expect(fields.address).toContain("Bremen");
  });

  it("parses price and sqm from page text", () => {
    const html = `<title>Wohnung</title><body>Kaufpreis 450.000 €, Wohnfläche 95 m², Energieeffizienzklasse B</body>`;
    const fields = parseListingHtml(html);
    expect(fields.price).toBe(450000);
    expect(fields.sizeSqm).toBe(95);
    expect(fields.energyClass).toBe("B");
  });

  it("parses sqm from free text", () => {
    expect(parseSqmFromText("Wohnfläche 95 m²")).toBe(95);
    expect(parseSqmFromText("no area here")).toBeUndefined();
  });

  it("validates energy class input", () => {
    expect(parseEnergyClassInput("c")).toBe("C");
    expect(parseEnergyClassInput("invalid")).toBeNull();
  });
});
