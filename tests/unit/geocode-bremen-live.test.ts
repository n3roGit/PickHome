import { describe, expect, it } from "vitest";
import { geocodeAddress } from "@/lib/geocode";
import { buildGeocodeQueryVariants, parseLooseGermanAddress } from "@/lib/geocode-address-queries";
import {
  TEST_ADDRESS_BREMEN_LAT,
  TEST_ADDRESS_BREMEN_LON,
  TEST_ADDRESS_BREMEN_POSTCODE,
  TEST_ADDRESS_BREMEN_RAW_LOOSE,
} from "../helpers/synthetic-addresses";

describe("live geocode Bremen (network)", () => {
  it("parses street number PLZ city correctly", () => {
    expect(parseLooseGermanAddress(TEST_ADDRESS_BREMEN_RAW_LOOSE)).toEqual({
      streetLine: "Mary-Somerville-Straße",
      houseNumber: "8",
      city: `${TEST_ADDRESS_BREMEN_POSTCODE} Bremen`,
    });
  });

  it("resolves coordinates via Nominatim", async () => {
    const result = await geocodeAddress(TEST_ADDRESS_BREMEN_RAW_LOOSE);
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(TEST_ADDRESS_BREMEN_LAT, 3);
    expect(result!.longitude).toBeCloseTo(TEST_ADDRESS_BREMEN_LON, 2);
    expect(result!.postcode).toBe(TEST_ADDRESS_BREMEN_POSTCODE);
  }, 30_000);
});

describe("buildGeocodeQueryVariants Bremen", () => {
  it("includes comma form with PLZ", () => {
    const variants = buildGeocodeQueryVariants(TEST_ADDRESS_BREMEN_RAW_LOOSE);
    expect(variants).toContain(
      `Mary-Somerville-Straße 8, ${TEST_ADDRESS_BREMEN_POSTCODE} Bremen`
    );
  });
});
