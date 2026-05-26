import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BORIS_CACHE_TTL_MS,
  getOrFetchBorisForApartment,
  refreshBorisForApartment,
} from "@/lib/boris-cache";
import * as boris from "@/lib/boris";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";

describe("boris-cache", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    const prisma = createTestPrisma();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    const prisma = createTestPrisma();
    await clearProjectData(prisma);
    await prisma.$disconnect();
  });

  it("returns fresh cache without calling BORIS again", async () => {
    const fetchSpy = vi.spyOn(boris, "fetchBorisForCoords");
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Apt",
        latitude: 53.085,
        longitude: 8.836,
      },
    });
    await prisma.apartmentBorisCache.create({
      data: {
        apartmentId: apartment.id,
        status: "ok",
        fetchedAt: new Date(),
        resultsJson: JSON.stringify([
          {
            kategorie: "brw_wohnbauflaeche",
            kategorieLabel: "Wohnbaufläche",
            brwEurPerSqm: 790,
            nutzungsart: "1100",
            nutzungsartLabel: "Wohnbaufläche (W)",
            erganzungNutzung: null,
            erganzungLabel: null,
            zoneNumber: "10003431",
            zoneName: "Zone 10003431",
            gemeinde: "Bremen",
            gemarkung: null,
            stichtag: "2023-01-01",
            entwicklungszustand: null,
            beitragsrecht: null,
          },
        ]),
      },
    });

    const snapshot = await getOrFetchBorisForApartment(prisma, apartment.id);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(snapshot.status).toBe("ok");
    expect(snapshot.results[0]?.brwEurPerSqm).toBe(790);
    await prisma.$disconnect();
  });

  it("stores no_coords when apartment has no coordinates", async () => {
    const fetchSpy = vi.spyOn(boris, "fetchBorisForCoords");
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Apt",
      },
    });

    const snapshot = await getOrFetchBorisForApartment(prisma, apartment.id);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(snapshot.status).toBe("no_coords");
    expect(snapshot.results).toEqual([]);
    await prisma.$disconnect();
  });

  it("refetches on refresh even when cache is fresh", async () => {
    vi.spyOn(boris, "fetchBorisForCoords").mockResolvedValue({
      ok: true,
      results: [
        {
          kategorie: "brw_wohnbauflaeche",
          kategorieLabel: "Wohnbaufläche",
          brwEurPerSqm: 1000,
          nutzungsart: "1100",
          nutzungsartLabel: "Wohnbaufläche (W)",
          erganzungNutzung: null,
          erganzungLabel: null,
          zoneNumber: "10003432",
          zoneName: "Zone 10003432",
          gemeinde: "Bremen",
          gemarkung: null,
          stichtag: "2023-01-01",
          entwicklungszustand: null,
          beitragsrecht: null,
        },
      ],
    });

    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Apt",
        latitude: 53.085,
        longitude: 8.836,
      },
    });
    await prisma.apartmentBorisCache.create({
      data: {
        apartmentId: apartment.id,
        status: "ok",
        fetchedAt: new Date(),
        resultsJson: "[]",
      },
    });

    const snapshot = await refreshBorisForApartment(prisma, apartment.id);

    expect(snapshot.status).toBe("ok");
    expect(snapshot.results[0]?.brwEurPerSqm).toBe(1000);
    await prisma.$disconnect();
  });

  it("refetches when cache is older than ttl", async () => {
    vi.spyOn(boris, "fetchBorisForCoords").mockResolvedValue({
      ok: true,
      results: [],
    });

    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Apt",
        latitude: 53.085,
        longitude: 8.836,
      },
    });
    await prisma.apartmentBorisCache.create({
      data: {
        apartmentId: apartment.id,
        status: "ok",
        fetchedAt: new Date(Date.now() - BORIS_CACHE_TTL_MS - 1),
        resultsJson: "[]",
      },
    });

    const snapshot = await getOrFetchBorisForApartment(prisma, apartment.id);

    expect(snapshot.status).toBe("no_data");
    await prisma.$disconnect();
  });
});
