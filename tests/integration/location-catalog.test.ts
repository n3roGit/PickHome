import { describe, expect, it } from "vitest";
import { resetTestDatabase, createTestPrisma } from "../helpers/test-db";

describe("location catalog integration", () => {
  it("stores cities with postal codes and districts", async () => {
    await resetTestDatabase();
    const prisma = createTestPrisma();

    const city = await prisma.locationCity.create({ data: { name: "Sample City" } });
    const postalCode = await prisma.locationPostalCode.create({
      data: { cityId: city.id, plz: "28203" },
    });
    await prisma.locationDistrict.createMany({
      data: [
        { postalCodeId: postalCode.id, name: "Fesenfeld" },
        { postalCodeId: postalCode.id, name: "Ostertor" },
      ],
    });

    const { fetchLocationCities } = await import("@/lib/location-areas-data");
    const catalog = await fetchLocationCities();

    expect(catalog).toHaveLength(1);
    expect(catalog[0].postalCodes[0].plz).toBe("28203");
    expect(catalog[0].postalCodes[0].districts).toEqual(["Fesenfeld", "Ostertor"]);
  });
});
