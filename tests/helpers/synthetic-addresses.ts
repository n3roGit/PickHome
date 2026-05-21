/**
 * Real, geocodable addresses for tests (public places only — never user/import data).
 * Nominatim is mocked in unit tests; labels below match mocked `suburb` fields.
 */

/** Berlin — Unter den Linden (exists). */
export const TEST_ADDRESS_BERLIN_RAW = "Unter den Linden 77, 10117 Berlin";
export const TEST_ADDRESS_BERLIN_DISTRICT = "Mitte";
export const TEST_ADDRESS_BERLIN_ENRICHED =
  "Unter den Linden 77, Mitte, 10117 Berlin";

/** Hamburg — Alter Fährweg (exists); district label only from geocoder mock. */
export const TEST_ADDRESS_HAMBURG_RAW = "Alter Fährweg 2, 20457 Hamburg";
export const TEST_ADDRESS_HAMBURG_DISTRICT = "HafenCity";
export const TEST_ADDRESS_HAMBURG_ENRICHED = "Alter Fährweg 2, HafenCity, 20457 Hamburg";

/** München — Marienplatz (exists). */
export const TEST_ADDRESS_MUNICH_RAW = "Marienplatz 8, 80331 München";
export const TEST_ADDRESS_MUNICH_DISTRICT = "Altstadt-Lehel";
export const TEST_ADDRESS_MUNICH_ENRICHED =
  "Marienplatz 8, Altstadt-Lehel, 80331 München";
