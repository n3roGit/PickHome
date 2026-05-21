import { describe, expect, it } from "vitest";
import {
  finalizeListingPreviewFields,
  inferBrokerInvolved,
  parseListingHtml,
  parseListingPlainText,
  parseEnergyClassInput,
  parseSqmFromText,
} from "@/lib/listing-import";

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

  it("parses fields from plain exposé text", () => {
    const text =
      "Kaufpreis 349.000 €, Wohnfläche 129 m², Energieeffizienzklasse F";
    const fields = parseListingPlainText(text);
    expect(fields.price).toBe(349000);
    expect(fields.sizeSqm).toBe(129);
    expect(fields.energyClass).toBe("F");
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

  it("maps highlights to description when missing", () => {
    const fields = finalizeListingPreviewFields({ price: 100 }, "Keller, Garten");
    expect(fields.description).toBe("Keller, Garten");
    expect(fields.price).toBe(100);
  });

  it("validates energy class input", () => {
    expect(parseEnergyClassInput("c")).toBe("C");
    expect(parseEnergyClassInput("invalid")).toBeNull();
  });

  it("detects broker from plain text", () => {
    expect(inferBrokerInvolved("Kaufpreis 300.000 €, provisionspflichtig")).toBe(true);
    expect(inferBrokerInvolved("Provisionsfrei, von privat")).toBe(false);
    expect(parseListingPlainText("Maklerprovision für Käufer fällig").brokerInvolved).toBe(
      true
    );
  });

  it("infers broker from portal URL when text is silent", () => {
    expect(
      inferBrokerInvolved("Wohnung in Bremen", "https://www.immobilienscout24.de/expose/1")
    ).toBe(true);
    expect(parseListingHtml("<title>Wohnung</title><body>95 m²</body>").brokerInvolved).toBe(
      undefined
    );
    expect(
      parseListingHtml("<title>Wohnung</title>", "https://www.immobilienscout24.de/x")
        .brokerInvolved
    ).toBe(true);
  });
});
