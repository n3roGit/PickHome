import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as externalFetch from "@/lib/external-fetch";
import {
  applyGeocodeToStoredAddress,
  districtFromNominatimAddress,
  enrichAddressWithDistrict,
  geocodeAddress,
  reverseGeocodeAddress,
} from "@/lib/geocode";
import {
  TEST_ADDRESS_BERLIN_DISTRICT,
  TEST_ADDRESS_BERLIN_ENRICHED,
  TEST_ADDRESS_BERLIN_RAW,
  TEST_ADDRESS_HAMBURG_DISTRICT,
  TEST_ADDRESS_HAMBURG_ENRICHED,
  TEST_ADDRESS_HAMBURG_RAW,
  TEST_ADDRESS_MUNICH_DISTRICT,
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
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
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
      displayName: TEST_ADDRESS_BERLIN_ENRICHED,
    });
  });

  it("returns null when fetch fails", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(null);
    expect(await geocodeAddress("invalid query xyz")).toBeNull();
  });
});

describe("districtFromNominatimAddress", () => {
  it("prefers suburb over city", () => {
    expect(
      districtFromNominatimAddress({
        city_district: "Ludwigsvorstadt",
        suburb: TEST_ADDRESS_MUNICH_DISTRICT,
      })
    ).toBe(TEST_ADDRESS_MUNICH_DISTRICT);
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

describe("applyGeocodeToStoredAddress", () => {
  it("enriches address for area matching", () => {
    const applied = applyGeocodeToStoredAddress(TEST_ADDRESS_BERLIN_RAW, {
      latitude: 52.517,
      longitude: 13.388,
      district: TEST_ADDRESS_BERLIN_DISTRICT,
      displayName: null,
    });
    expect(applied.address).toBe(TEST_ADDRESS_BERLIN_ENRICHED);
    expect(applied.latitude).toBe(52.517);
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
