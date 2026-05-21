import { describe, expect, it } from "vitest";
import {
  buildGeocodeQueryVariants,
  isDistrictPlzGermanAddress,
  parseLooseGermanAddress,
  pickBestHouseHit,
  streetSimilarity,
} from "@/lib/geocode-address-queries";
import {
  TEST_ADDRESS_DISTRICT_PLZ_RAW,
  TEST_ADDRESS_KIEL_CITY,
  TEST_FAKE_CITY,
  TEST_FAKE_DISTRICT,
  TEST_ADDRESS_KIEL_DECOY_CITY,
  TEST_ADDRESS_KIEL_DISTRICT,
  TEST_ADDRESS_KIEL_HOUSE,
  TEST_ADDRESS_KIEL_POSTCODE,
  TEST_ADDRESS_KIEL_RAW_LOOSE,
  TEST_ADDRESS_KIEL_STREET_CORRECT,
  TEST_ADDRESS_KIEL_STREET_TYPED,
  TEST_FAKE_CITY,
  TEST_FAKE_RAW_LOOSE,
  TEST_FAKE_STREET,
} from "../helpers/synthetic-addresses";

describe("parseLooseGermanAddress", () => {
  it("parses street number city without commas", () => {
    expect(parseLooseGermanAddress(`${TEST_FAKE_STREET} 2 ${TEST_FAKE_CITY}`)).toEqual({
      streetLine: TEST_FAKE_STREET,
      houseNumber: "2",
      city: TEST_FAKE_CITY,
    });
  });

  it("parses comma-separated form", () => {
    expect(parseLooseGermanAddress(`${TEST_FAKE_STREET} 2, ${TEST_FAKE_CITY}`)).toEqual({
      streetLine: TEST_FAKE_STREET,
      houseNumber: "2",
      city: TEST_FAKE_CITY,
    });
  });

  it("parses district, PLZ and city", () => {
    expect(parseLooseGermanAddress(TEST_ADDRESS_DISTRICT_PLZ_RAW)).toEqual({
      streetLine: TEST_FAKE_DISTRICT,
      houseNumber: null,
      city: "99999 Teststadt",
    });
  });
});

describe("buildGeocodeQueryVariants", () => {
  it("adds country and comma variants", () => {
    const variants = buildGeocodeQueryVariants(TEST_FAKE_RAW_LOOSE);
    expect(variants[0]).toBe(TEST_FAKE_RAW_LOOSE);
    expect(variants).toContain(`exampleweg 2, ${TEST_FAKE_CITY}`);
    expect(variants).toContain(`exampleweg 2, ${TEST_FAKE_CITY}, Deutschland`);
  });

  it("uses fewer variants for district + PLZ lines", () => {
    expect(isDistrictPlzGermanAddress(TEST_ADDRESS_DISTRICT_PLZ_RAW)).toBe(true);
    const variants = buildGeocodeQueryVariants(TEST_ADDRESS_DISTRICT_PLZ_RAW);
    expect(variants).toEqual([
      TEST_ADDRESS_DISTRICT_PLZ_RAW,
      `${TEST_ADDRESS_DISTRICT_PLZ_RAW}, Deutschland`,
    ]);
  });
});

describe("streetSimilarity", () => {
  it("treats minor street typos as similar", () => {
    expect(
      streetSimilarity(TEST_ADDRESS_KIEL_STREET_TYPED, TEST_ADDRESS_KIEL_STREET_CORRECT)
    ).toBeGreaterThanOrEqual(0.82);
  });
});

describe("pickBestHouseHit", () => {
  it("selects house in target city with similar street name", () => {
    const parsed = parseLooseGermanAddress(TEST_ADDRESS_KIEL_RAW_LOOSE)!;
    const hit = pickBestHouseHit(
      [
        {
          lat: "54.3232",
          lon: "10.1224",
          type: "house",
          class: "place",
          place_rank: 30,
          address: {
            house_number: TEST_ADDRESS_KIEL_HOUSE,
            road: TEST_ADDRESS_KIEL_STREET_CORRECT,
            suburb: TEST_ADDRESS_KIEL_DISTRICT,
            city: TEST_ADDRESS_KIEL_CITY,
            postcode: TEST_ADDRESS_KIEL_POSTCODE,
          },
        },
        {
          lat: "54.78",
          lon: "9.43",
          address: {
            road: TEST_ADDRESS_KIEL_STREET_CORRECT,
            city: TEST_ADDRESS_KIEL_DECOY_CITY,
            house_number: TEST_ADDRESS_KIEL_HOUSE,
          },
        },
      ],
      parsed
    );
    expect(hit?.address?.city).toBe(TEST_ADDRESS_KIEL_CITY);
    expect(hit?.address?.suburb).toBe(TEST_ADDRESS_KIEL_DISTRICT);
  });
});
