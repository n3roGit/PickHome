import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as externalFetch from "@/lib/external-fetch";
import {
  enrichApartmentAddressRecord,
  resolveApartmentGeocode,
} from "@/lib/apartment-address-enrichment";
import {
  TEST_ADDRESS_HAMBURG_DISTRICT,
  TEST_ADDRESS_HAMBURG_ENRICHED,
  TEST_ADDRESS_HAMBURG_RAW,
} from "../helpers/synthetic-addresses";

describe("resolveApartmentGeocode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges district from reverse when forward search has no suburb", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockImplementation(async (_service, url) => {
      const u = String(url);
      if (u.includes("/search")) {
        return new Response(
          JSON.stringify([{ lat: "53.543", lon: "9.993", address: { city: "Hamburg" } }]),
          { status: 200 }
        );
      }
      if (u.includes("/reverse")) {
        return new Response(
          JSON.stringify({
            lat: "53.543",
            lon: "9.993",
            address: {
              suburb: TEST_ADDRESS_HAMBURG_DISTRICT,
              postcode: "20457",
              city: "Hamburg",
            },
          }),
          { status: 200 }
        );
      }
      return null;
    });

    const result = await resolveApartmentGeocode(TEST_ADDRESS_HAMBURG_RAW, {
      latitude: 53.543,
      longitude: 9.993,
    });
    expect(result?.district).toBe(TEST_ADDRESS_HAMBURG_DISTRICT);
  });
});

describe("enrichApartmentAddressRecord", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates address when district is added", async () => {
    vi.spyOn(externalFetch, "fetchExternal").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: "53.543",
            lon: "9.993",
            address: {
              suburb: TEST_ADDRESS_HAMBURG_DISTRICT,
              postcode: "20457",
              city: "Hamburg",
            },
          },
        ]),
        { status: 200 }
      )
    );

    const result = await enrichApartmentAddressRecord({
      id: "apt-test-1",
      projectId: "proj-test-1",
      address: TEST_ADDRESS_HAMBURG_RAW,
      latitude: null,
      longitude: null,
    });

    expect(result.updated).toBe(true);
    expect(result.address).toBe(TEST_ADDRESS_HAMBURG_ENRICHED);
  });
});
