import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as routing from "@/lib/routing";
import { computeCommuteLegs, invalidateCommuteCacheForApartment } from "@/lib/commute";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";

describe("commute cache integration", () => {
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

  it("reuses DB cache on repeat lookup without calling OSRM again", async () => {
    const fetchRoute = vi.spyOn(routing, "fetchRoute").mockResolvedValue({
      distanceMeters: 10_300,
      durationSeconds: 19 * 60,
    });

    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Test apt",
        latitude: 53.08,
        longitude: 8.8,
      },
    });
    const userAddress = await prisma.userAddress.create({
      data: {
        userId: user.id,
        label: "Arbeit",
        address: "Mary-Somerville-Straße 8, 28359 Bremen",
        latitude: 53.1,
        longitude: 8.85,
      },
    });

    const input = {
      apartmentId: apartment.id,
      apartment: { latitude: apartment.latitude!, longitude: apartment.longitude! },
      addresses: [
        {
          id: userAddress.id,
          label: userAddress.label,
          address: userAddress.address,
          latitude: userAddress.latitude,
          longitude: userAddress.longitude,
        },
      ],
      travelMode: "driving" as const,
    };

    const first = await computeCommuteLegs(input);
    expect(first[0]?.distanceText).toBe("10,3 km");
    expect(first[0]?.durationText).toBe("19 Min.");
    expect(fetchRoute).toHaveBeenCalledTimes(1);

    fetchRoute.mockClear();
    const second = await computeCommuteLegs(input);
    expect(second[0]?.distanceText).toBe("10,3 km");
    expect(fetchRoute).not.toHaveBeenCalled();

    const cacheCount = await prisma.commuteCache.count({
      where: { apartmentId: apartment.id, userAddressId: userAddress.id },
    });
    expect(cacheCount).toBe(1);
    await prisma.$disconnect();
  });

  it("clears cache when apartment coordinates change", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: { projectId: project.id, title: "Test apt", latitude: 53.0, longitude: 8.0 },
    });
    const userAddress = await prisma.userAddress.create({
      data: {
        userId: user.id,
        label: "Home",
        address: "Bremen",
        latitude: 53.1,
        longitude: 8.9,
      },
    });
    await prisma.commuteCache.create({
      data: {
        apartmentId: apartment.id,
        userAddressId: userAddress.id,
        travelMode: "driving",
        distanceMeters: 5000,
        durationSeconds: 600,
      },
    });

    await invalidateCommuteCacheForApartment(apartment.id);
    const count = await prisma.commuteCache.count({ where: { apartmentId: apartment.id } });
    expect(count).toBe(0);
    await prisma.$disconnect();
  });
});
