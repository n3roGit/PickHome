import { describe, expect, it } from "vitest";
import { parseLocationCatalogImport } from "@/lib/location-catalog-import";

describe("parseLocationCatalogImport", () => {
  it("parses pipe-separated table rows", () => {
    const raw = `
28203 | Bremen | Fesenfeld, Ostertor, Steintor
28205 | Bremen | Findorff, Walle
    `.trim();

    const parsed = parseLocationCatalogImport(raw, "Bremen");
    expect(parsed).not.toBeNull();
    expect(parsed!.cityName).toBe("Bremen");
    expect(parsed!.rows).toHaveLength(2);
    expect(parsed!.rows[0]).toEqual({
      plz: "28203",
      cityName: "Bremen",
      districts: ["Fesenfeld", "Ostertor", "Steintor"],
    });
  });

  it("parses comma-separated rows without city column", () => {
    const raw = "28209, Arsten, Hastedt, Hemelingen";
    const parsed = parseLocationCatalogImport(raw, "Bremen");
    expect(parsed?.rows[0].districts).toEqual(["Arsten", "Hastedt", "Hemelingen"]);
  });

  it("returns null for empty input", () => {
    expect(parseLocationCatalogImport("", "Bremen")).toBeNull();
    expect(parseLocationCatalogImport("no plz here", "Bremen")).toBeNull();
  });
});
