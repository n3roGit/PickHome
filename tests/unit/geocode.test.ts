import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as externalFetch from "@/lib/external-fetch";
import {
  applyGeocodeToStoredAddress,
  districtFromNominatimAddress,
  enrichAddressWithDistrict,
  enrichAddressWithPostcode,
  formatCanonicalGermanAddress,
  geocodeAddress,
  reverseGeocodeAddress,
} from "@/lib/geocode";
import {
  TEST_ADDRESS_BERLIN_AFTER_POSTCODE,
  TEST_ADDRESS_BERLIN_BEFORE_POSTCODE,
  TEST_ADDRESS_BERLIN_DISTRICT,
  TEST_ADDRESS_BERLIN_ENRICHED,
  TEST_ADDRESS_BERLIN_POSTCODE,
  TEST_ADDRESS_BERLIN_RAW,
  TEST_FAKE_RAW_LOOSE,
  TEST_ADDRESS_HAMBURG_DISTRICT,
  TEST_ADDRESS_HAMBURG_ENRICHED,
  TEST_ADDRESS_HAMBURG_POSTCODE,
  TEST_ADDRESS_HAMBURG_RAW,
  TEST_FAKE_CITY,
  TEST_FAKE_DISTRICT,
  TEST_FAKE_RAW_LOOSE,
  TEST_FAKE_STREET,
} from "../helpers/synthetic-addresses";

describe("geocodeAddress", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for empty input", async () => {
    expect(await geocodeAddress("")).toBeNull();
    expect(await geocodeAddress("   ")).toBeNull();
  });

  it("returns null when API has no results", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockImplementation(async () =>
      new Response(JSON.stringify([]), { status: 200 })
    );
    expect(await geocodeAddress("Nowhere")).toBeNull();
  });

  it("returns coordinates and district on success", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: "52.5170365",
            lon: "13.3888599",
            display_name: TEST_ADDRESS_BERLIN_ENRICHED,
            address: {
              road: "Unter den Linden",
              house_number: "77",
              suburb: TEST_ADDRESS_BERLIN_DISTRICT,
              postcode: "10117",
              city: "Berlin",
            },
          },
        ]),
        { status: 200 }
      )
    );
    const result = await geocodeAddress(TEST_ADDRESS_BERLIN_RAW);
    expect(result).toEqual({
      latitude: 52.5170365,
      longitude: 13.3888599,
      district: TEST_ADDRESS_BERLIN_DISTRICT,
      postcode: TEST_ADDRESS_BERLIN_POSTCODE,
      canonicalAddress: TEST_ADDRESS_BERLIN_ENRICHED,
      displayName: TEST_ADDRESS_BERLIN_ENRICHED,
    });
  });

  it("returns null when fetch fails", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(null);
    expect(await geocodeAddress("invalid query xyz")).toBeNull();
  });

  it("tries comma-separated variant when first query has no hit", async () => {
    const fetch = vi.spyOn(externalFetch, "fetchExternal").mockImplementation(async (_s, url) => {
      const u = decodeURIComponent(String(url).replace(/\+/g, " "));
      if (u.includes(`exampleweg 2, ${TEST_FAKE_CITY}`)) {
        return new Response(
          JSON.stringify([
            {
              lat: "48.100",
              lon: "11.200",
              address: {
                road: "exampleweg",
                house_number: "2",
                suburb: TEST_FAKE_DISTRICT,
                postcode: "80331",
                city: TEST_FAKE_CITY,
              },
            },
          ]),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const result = await geocodeAddress(TEST_FAKE_RAW_LOOSE);
    expect(result?.district).toBe(TEST_FAKE_DISTRICT);
    expect(fetch.mock.calls.length).toBeGreaterThan(1);
    fetch.mockRestore();
  });
});

describe("districtFromNominatimAddress", () => {
  it("prefers suburb over city", () => {
    expect(
      districtFromNominatimAddress({
        city_district: "Innenstadt",
        suburb: TEST_ADDRESS_HAMBURG_DISTRICT,
      })
    ).toBe(TEST_ADDRESS_HAMBURG_DISTRICT);
  });
});

describe("enrichAddressWithPostcode", () => {
  it("inserts PLZ before city when missing", () => {
    expect(
      enrichAddressWithPostcode(
        TEST_ADDRESS_BERLIN_BEFORE_POSTCODE,
        TEST_ADDRESS_BERLIN_POSTCODE
      )
    ).toBe(TEST_ADDRESS_BERLIN_AFTER_POSTCODE);
  });
});

describe("enrichAddressWithDistrict", () => {
  it("inserts district before PLZ when missing", () => {
    expect(
      enrichAddressWithDistrict(TEST_ADDRESS_HAMBURG_RAW, TEST_ADDRESS_HAMBURG_DISTRICT)
    ).toBe(TEST_ADDRESS_HAMBURG_ENRICHED);
  });

  it("leaves address unchanged when district already present", () => {
    expect(
      enrichAddressWithDistrict(TEST_ADDRESS_HAMBURG_ENRICHED, TEST_ADDRESS_HAMBURG_DISTRICT)
    ).toBe(TEST_ADDRESS_HAMBURG_ENRICHED);
  });
});

describe("formatCanonicalGermanAddress", () => {
  it("formats street, district, plz and city", () => {
    expect(
      formatCanonicalGermanAddress({
        road: "Unter den Linden",
        house_number: "77",
        suburb: TEST_ADDRESS_BERLIN_DISTRICT,
        postcode: TEST_ADDRESS_BERLIN_POSTCODE,
        city: "Berlin",
      })
    ).toBe(TEST_ADDRESS_BERLIN_ENRICHED);
  });
});

describe("applyGeocodeToStoredAddress", () => {
  it("uses canonical address when geocode succeeded", () => {
    const applied = applyGeocodeToStoredAddress("messy input", {
      latitude: 52.517,
      longitude: 13.388,
      district: TEST_ADDRESS_BERLIN_DISTRICT,
      postcode: TEST_ADDRESS_BERLIN_POSTCODE,
      canonicalAddress: TEST_ADDRESS_BERLIN_ENRICHED,
      displayName: null,
    });
    expect(applied.address).toBe(TEST_ADDRESS_BERLIN_ENRICHED);
    expect(applied.latitude).toBe(52.517);
  });

  it("keeps user input when geocode failed", () => {
    const applied = applyGeocodeToStoredAddress(TEST_FAKE_RAW_LOOSE, null);
    expect(applied.address).toBe(TEST_FAKE_RAW_LOOSE);
    expect(applied.latitude).toBeNull();
  });

  it("enriches raw street when canonical omits road", () => {
    const applied = applyGeocodeToStoredAddress(TEST_ADDRESS_HAMBURG_RAW, {
      latitude: 53.543,
      longitude: 9.993,
      district: TEST_ADDRESS_HAMBURG_DISTRICT,
      postcode: TEST_ADDRESS_HAMBURG_POSTCODE,
      canonicalAddress: `${TEST_ADDRESS_HAMBURG_DISTRICT}, ${TEST_ADDRESS_HAMBURG_POSTCODE} Hamburg`,
      displayName: null,
    });
    expect(applied.address).toBe(TEST_ADDRESS_HAMBURG_ENRICHED);
  });
});

describe("reverseGeocodeAddress", () => {
  it("parses reverse response", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
      new Response(
        JSON.stringify({
          lat: "53.54598",
          lon: "9.96665",
          address: {
            suburb: TEST_ADDRESS_HAMBURG_DISTRICT,
            postcode: "20457",
            city: "Hamburg",
          },
        }),
        { status: 200 }
      )
    );
    const result = await reverseGeocodeAddress(53.54598, 9.96665);
    expect(result?.district).toBe(TEST_ADDRESS_HAMBURG_DISTRICT);
  });
});
