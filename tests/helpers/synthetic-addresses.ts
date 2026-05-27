/**
 * Addresses for tests only — never copy from local `data/`, seeds, backups, or house-hunt notes.
 * Use public, geocodable places (OSM/Nominatim) or fully fictional labels (`Teststadt`, `Exampleweg`).
 * Import from this file in unit/integration tests; do not inline street/city/PLZ literals in test files.
 * Nominatim is mocked in most unit tests; district labels must match mocked `suburb` fields below.
 */

/** Berlin — Unter den Linden (public). */
export const TEST_ADDRESS_BERLIN_RAW = "Unter den Linden 77, 10117 Berlin";
export const TEST_ADDRESS_BERLIN_DISTRICT = "Mitte";
export const TEST_ADDRESS_BERLIN_ENRICHED =
  "Unter den Linden 77, Mitte, 10117 Berlin";
export const TEST_ADDRESS_BERLIN_BEFORE_POSTCODE =
  "Unter den Linden 77, Mitte, Berlin";
export const TEST_ADDRESS_BERLIN_AFTER_POSTCODE =
  "Unter den Linden 77, Mitte, 10117 Berlin";
export const TEST_ADDRESS_BERLIN_POSTCODE = "10117";

/** Hamburg — Alter Fährweg (public). */
export const TEST_ADDRESS_HAMBURG_RAW = "Alter Fährweg 2, 20457 Hamburg";
export const TEST_ADDRESS_HAMBURG_DISTRICT = "HafenCity";
export const TEST_ADDRESS_HAMBURG_ENRICHED = "Alter Fährweg 2, HafenCity, 20457 Hamburg";
export const TEST_ADDRESS_HAMBURG_POSTCODE = "20457";

/** München — Marienplatz (public). */
export const TEST_ADDRESS_MUNICH_RAW = "Marienplatz 8, 80331 München";
export const TEST_ADDRESS_MUNICH_DISTRICT = "Altstadt-Lehel";
export const TEST_ADDRESS_MUNICH_ENRICHED =
  "Marienplatz 8, Altstadt-Lehel, 80331 München";

/** Bremen — Mary-Somerville-Straße (public OSM). */
export const TEST_ADDRESS_BREMEN_RAW_LOOSE = "Mary-Somerville-Straße 8 28359 Bremen";
export const TEST_ADDRESS_BREMEN_RAW = "Mary-Somerville-Straße 8, 28359 Bremen";
export const TEST_ADDRESS_BREMEN_POSTCODE = "28359";
export const TEST_ADDRESS_BREMEN_LAT = 53.1055673;
export const TEST_ADDRESS_BREMEN_LON = 8.8620598;

/** Fictional — parser/query-variant tests only (not real OSM places). */
export const TEST_FAKE_STREET = "Exampleweg";
export const TEST_FAKE_CITY = "Teststadt";
export const TEST_FAKE_RAW_LOOSE = "exampleweg 2 teststadt";
export const TEST_FAKE_DISTRICT = "Nordstadt";
/** District + PLZ + city without street (listing import style). */
export const TEST_ADDRESS_DISTRICT_PLZ_RAW = `${TEST_FAKE_DISTRICT}, 99999 ${TEST_FAKE_CITY}`;
export const TEST_FAKE_POSTCODE = "99999";

/** Kiel — Holstenstraße (public); typo pair for similarity / pickBestHouseHit tests. */
export const TEST_ADDRESS_KIEL_RAW_LOOSE = "holstenstr 47 kiel";
export const TEST_ADDRESS_KIEL_STREET_TYPED = "Holstenstr";
export const TEST_ADDRESS_KIEL_STREET_CORRECT = "Holstenstraße";
export const TEST_ADDRESS_KIEL_HOUSE = "47";
export const TEST_ADDRESS_KIEL_CITY = "Kiel";
export const TEST_ADDRESS_KIEL_DISTRICT = "Altstadt";
export const TEST_ADDRESS_KIEL_POSTCODE = "24103";
/** Decoy city in multi-hit ranking tests. */
export const TEST_ADDRESS_KIEL_DECOY_CITY = "Flensburg";
