import { describe, expect, it } from "vitest";
import { TEST_FAKE_CITY, TEST_FAKE_POSTCODE } from "../helpers/synthetic-addresses";
import {
  extractRelaxedJsonLdPropertyAddress,
  isBrokerOfficeAddress,
  pickPropertyListingAddress,
} from "@/lib/listing-address";

const IMMOBILIEN_HTML = `
<script type="application/ld+json">
{
  "@type": "SingleFamilyResidence",
  "name": "Reihenhaus-Unikat in ${TEST_FAKE_CITY}-Nord",
  "address": { "postalCode": "${TEST_FAKE_POSTCODE}", "addressLocality": "${TEST_FAKE_CITY}", "addressCountry": "DE" }
}
</script>
<body>
  <h1>${TEST_FAKE_POSTCODE} ${TEST_FAKE_CITY}</h1>
  <p>Das Objekt liegt in ${TEST_FAKE_CITY}-Nord.</p>
  <footer>Example Immobilien GmbH, Officeallee 120, 99998 ${TEST_FAKE_CITY}</footer>
</body>
`;

describe("listing-address", () => {
  it("detects broker office street addresses", () => {
    expect(isBrokerOfficeAddress("Elisabethstr. 120, 28217 Bremen")).toBe(true);
    expect(isBrokerOfficeAddress("Walle, 28219 Bremen")).toBe(false);
  });

  it("extracts property PLZ from broken JSON-LD", () => {
    expect(extractRelaxedJsonLdPropertyAddress(IMMOBILIEN_HTML)).toBe(
      `Nord, ${TEST_FAKE_POSTCODE} ${TEST_FAKE_CITY}`
    );
  });

  it("prefers property PLZ over broker office street", () => {
    const address = pickPropertyListingAddress({
      title: `Reihenhaus in ${TEST_FAKE_CITY}-Nord`,
      textBlob: `${TEST_FAKE_POSTCODE} ${TEST_FAKE_CITY} Nord. Officeallee 120, 99998 ${TEST_FAKE_CITY} Makler GmbH`,
      heuristicStreet: `Officeallee 120, 99998 ${TEST_FAKE_CITY}`,
      relaxedJsonLdAddress: `Nord, ${TEST_FAKE_POSTCODE} ${TEST_FAKE_CITY}`,
    });
    expect(address).toBe(`Nord, ${TEST_FAKE_POSTCODE} ${TEST_FAKE_CITY}`);
  });
});
