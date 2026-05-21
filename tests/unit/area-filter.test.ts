import { describe, expect, it } from "vitest";
import {
  areaFilterLabel,
  areaFilterMode,
  areaFilterOrtKeys,
  areaFilterSectionTitle,
  extractDistrictFromAddress,
  isAreaFilterActive,
  matchApartmentToAreaFilter,
  parseAreaFilterConfig,
  serializeAreaFilterConfig,
} from "@/lib/area-filter";

const customDistrictsByPlz: Record<string, string[]> = {
  "28203": ["Fesenfeld", "Ostertor", "Östliche Vorstadt", "Steintor"],
  "28207": ["Hastedt"],
  "28209": ["Bürgerweide/Barkhof"],
};

const config = {
  selectedPlz: ["28203", "28207"],
  selectedDistricts: ["Fesenfeld", "Ostertor", "Hastedt"],
};

describe("area-filter", () => {
  it("parses and serializes config", () => {
    const raw = serializeAreaFilterConfig(config);
    expect(parseAreaFilterConfig(raw)).toEqual({
      selectedPlz: ["28203", "28207"],
      selectedDistricts: ["Fesenfeld", "Hastedt", "Ostertor"],
    });
  });

  it("detects active filter", () => {
    expect(isAreaFilterActive("Bremen|Bremen", config)).toBe(true);
    expect(isAreaFilterActive(null, config)).toBe(false);
    expect(isAreaFilterActive("Bremen|Bremen", { selectedPlz: [], selectedDistricts: [] })).toBe(
      false
    );
  });

  it("parses ortKeys and resolves multi-city keys", () => {
    const multi = {
      ortKeys: ["Hamburg|Hamburg", "Berlin|Berlin"],
      selectedPlz: ["10115", "20095"],
      selectedDistricts: [] as string[],
    };
    const raw = serializeAreaFilterConfig(multi);
    expect(parseAreaFilterConfig(raw)).toEqual(multi);
    expect(areaFilterOrtKeys(null, multi)).toEqual(["Hamburg|Hamburg", "Berlin|Berlin"]);
    expect(areaFilterOrtKeys("Bremen|Bremen", multi)).toEqual(["Hamburg|Hamburg", "Berlin|Berlin"]);
    expect(areaFilterOrtKeys("Bremen|Bremen", config)).toEqual(["Bremen|Bremen"]);
    expect(isAreaFilterActive(null, multi)).toBe(true);
  });

  it("matches inside across multiple cities by PLZ union", () => {
    const multiConfig = {
      ortKeys: ["Hamburg|Hamburg", "Berlin|Berlin"],
      selectedPlz: ["20095", "10115"],
      selectedDistricts: [] as string[],
    };
    expect(
      matchApartmentToAreaFilter("Musterweg 1, 20095 Hamburg", null, multiConfig, {}).status
    ).toBe("inside");
    expect(
      matchApartmentToAreaFilter("Beispielstr. 2, 10115 Berlin", null, multiConfig, {}).status
    ).toBe("inside");
    expect(
      matchApartmentToAreaFilter("Weg 3, 28199 Bremen", null, multiConfig, {}).status
    ).toBe("outside");
  });

  it("matches inside when PLZ and district match", () => {
    const result = matchApartmentToAreaFilter(
      "Beispielweg 1, 28203 Bremen Fesenfeld",
      "Bremen|Bremen",
      config,
      customDistrictsByPlz
    );
    expect(result.status).toBe("inside");
    expect(result.plz).toBe("28203");
    expect(result.district).toBe("Fesenfeld");
  });

  it("matches inside on PLZ only when no districts configured", () => {
    const result = matchApartmentToAreaFilter(
      "Weg 1, 12345 Beispielort",
      "Beispielort|Bayern",
      { selectedPlz: ["12345"], selectedDistricts: [] },
      {}
    );
    expect(result.status).toBe("inside");
  });

  it("matches outside for wrong PLZ", () => {
    const result = matchApartmentToAreaFilter(
      "Musterstr. 2, 28199 Bremen",
      "Bremen|Bremen",
      config,
      customDistrictsByPlz
    );
    expect(result.status).toBe("outside");
    expect(result.plz).toBe("28199");
  });

  it("matches outside when district excluded", () => {
    const result = matchApartmentToAreaFilter(
      "Weg 1, 28203 Bremen Steintor",
      "Bremen|Bremen",
      config,
      customDistrictsByPlz
    );
    expect(result.status).toBe("outside");
    expect(result.district).toBe("Steintor");
  });

  it("matches inside when all districts of PLZ are selected", () => {
    const fullPlzConfig = {
      selectedPlz: ["28207"],
      selectedDistricts: ["Hastedt"],
    };
    const result = matchApartmentToAreaFilter(
      "Weg 3, 28207 Bremen",
      "Bremen|Bremen",
      fullPlzConfig,
      customDistrictsByPlz
    );
    expect(result.status).toBe("inside");
  });

  it("returns unknown when district cannot be determined", () => {
    const partialConfig = {
      selectedPlz: ["28203"],
      selectedDistricts: ["Fesenfeld"],
    };
    const result = matchApartmentToAreaFilter(
      "Weg 4, 28203 Bremen",
      "Bremen|Bremen",
      partialConfig,
      customDistrictsByPlz
    );
    expect(result.status).toBe("unknown");
  });

  it("matches inside on PLZ when custom districts exist but none are selected", () => {
    const importedLikeCatalog: Record<string, string[]> = {
      "28209": [
        "Barkhof",
        "Bremen-Mitte",
        "Bremen-Ost",
        "Bürgerpark",
        "Bürgerweide",
        "Mitte",
        "Schwachhausen",
      ],
    };
    const importedConfig = {
      selectedPlz: ["28209"],
      selectedDistricts: ["Bremen-Mitte", "Bremen-Ost", "Mitte", "Schwachhausen"],
    };
    const result = matchApartmentToAreaFilter(
      "Carl-Schurz-Str. 29; 28209 Bremen",
      "Bremen|Bremen",
      importedConfig,
      importedLikeCatalog
    );
    expect(result.status).toBe("inside");
    expect(result.plz).toBe("28209");
  });

  it("extracts district with slash variant", () => {
    const district = extractDistrictFromAddress("28209 Bremen Bürgerweide Barkhof", [
      "Bürgerweide/Barkhof",
    ]);
    expect(district).toBe("Bürgerweide/Barkhof");
  });

  it("returns unset when filter inactive", () => {
    expect(matchApartmentToAreaFilter("28203 Bremen", null, null, {}).status).toBe("unset");
  });

  it("parses and serializes deny mode", () => {
    const denyConfig = {
      selectedPlz: ["20095"],
      selectedDistricts: [] as string[],
      mode: "deny" as const,
    };
    const raw = serializeAreaFilterConfig(denyConfig);
    expect(parseAreaFilterConfig(raw)).toEqual(denyConfig);
    expect(areaFilterMode(denyConfig)).toBe("deny");
    expect(areaFilterSectionTitle("deny")).toBe("NoGo-Zone");
  });

  it("uses inverted labels in deny mode", () => {
    expect(areaFilterLabel("inside", "deny")).toBe("In NoGo-Zone");
    expect(areaFilterLabel("outside", "deny")).toBe("Außerhalb NoGo-Zone");
    expect(areaFilterLabel("inside", "allow")).toBe("Im Wunschgebiet");
  });
});
