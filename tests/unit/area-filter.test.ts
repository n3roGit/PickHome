import { describe, expect, it } from "vitest";
import {
  extractDistrictFromAddress,
  isAreaFilterActive,
  matchApartmentToAreaFilter,
  parseAreaFilterConfig,
  serializeAreaFilterConfig,
} from "@/lib/area-filter";
import type { LocationCity } from "@/lib/location-areas";

const catalog: LocationCity[] = [
  {
    id: "sample-city",
    name: "Sample City",
    postalCodes: [
      {
        plz: "28203",
        districts: ["Fesenfeld", "Ostertor", "Östliche Vorstadt", "Steintor"],
      },
      {
        plz: "28207",
        districts: ["Hastedt"],
      },
      {
        plz: "28209",
        districts: ["Bürgerweide/Barkhof"],
      },
    ],
  },
];

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
    expect(isAreaFilterActive("sample-city", config)).toBe(true);
    expect(isAreaFilterActive(null, config)).toBe(false);
    expect(isAreaFilterActive("sample-city", { selectedPlz: [], selectedDistricts: [] })).toBe(
      false
    );
  });

  it("matches inside when PLZ and district match", () => {
    const result = matchApartmentToAreaFilter(
      "Beispielweg 1, 28203 Sample City Fesenfeld",
      "sample-city",
      config,
      catalog
    );
    expect(result.status).toBe("inside");
    expect(result.plz).toBe("28203");
    expect(result.district).toBe("Fesenfeld");
  });

  it("matches outside for wrong PLZ", () => {
    const result = matchApartmentToAreaFilter(
      "Musterstr. 2, 28199 Sample City",
      "sample-city",
      config,
      catalog
    );
    expect(result.status).toBe("outside");
    expect(result.plz).toBe("28199");
  });

  it("matches outside when district excluded", () => {
    const result = matchApartmentToAreaFilter(
      "Weg 1, 28203 Sample City Steintor",
      "sample-city",
      config,
      catalog
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
      "Weg 3, 28207 Sample City",
      "sample-city",
      fullPlzConfig,
      catalog
    );
    expect(result.status).toBe("inside");
  });

  it("returns unknown when district cannot be determined", () => {
    const partialConfig = {
      selectedPlz: ["28203"],
      selectedDistricts: ["Fesenfeld"],
    };
    const result = matchApartmentToAreaFilter(
      "Weg 4, 28203 Sample City",
      "sample-city",
      partialConfig,
      catalog
    );
    expect(result.status).toBe("unknown");
  });

  it("extracts district with slash variant", () => {
    const district = extractDistrictFromAddress("28209 Sample City Bürgerweide Barkhof", [
      "Bürgerweide/Barkhof",
    ]);
    expect(district).toBe("Bürgerweide/Barkhof");
  });

  it("returns unset when filter inactive", () => {
    expect(matchApartmentToAreaFilter("28203 Sample City", null, null, catalog).status).toBe(
      "unset"
    );
  });
});
