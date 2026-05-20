import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as routing from "@/lib/routing";
import * as transitRouting from "@/lib/transit-routing";
import { computeCommuteLegs, invalidateCommuteCacheForApartment } from "@/lib/commute";
import { findMissingCommuteLegs, runCommuteBackfillTick } from "@/lib/commute-backfill";
import { reindexProjectCommute } from "@/lib/commute-reindex";
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
          isWorkplace: false,
        },
      ],
      travelMode: "driving" as const,
      transitSettings: null,
      companyCar: false,
      companyCarRate: null,
      listPrice: null,
      marginalTaxRatePercent: null,
      companyCarCommuteMethod: null,
      companyCarOfficeTripsPerMonth: null,
      companyCarContributionEur: null,
      companyCarSelfPaidCostsEur: null,
      companyCarEmployerFuelCard: true,
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

  it("reindexProjectCommute clears cache and repopulates routes", async () => {
    vi.spyOn(routing, "fetchRoute").mockResolvedValue({
      distanceMeters: 4200,
      durationSeconds: 8 * 60,
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
        address: "Bremen",
        latitude: 53.1,
        longitude: 8.85,
      },
    });
    await prisma.commuteCache.create({
      data: {
        apartmentId: apartment.id,
        userAddressId: userAddress.id,
        travelMode: "driving",
        distanceMeters: 999,
        durationSeconds: 99,
      },
    });

    const result = await reindexProjectCommute(project.id);
    expect(result.routesComputed).toBeGreaterThanOrEqual(1);
    expect(result.apartmentsWithCoords).toBe(1);

    const cached = await prisma.commuteCache.findUnique({
      where: {
        apartmentId_userAddressId_travelMode: {
          apartmentId: apartment.id,
          userAddressId: userAddress.id,
          travelMode: "driving",
        },
      },
    });
    expect(cached?.distanceMeters).toBe(4200);
    await prisma.$disconnect();
  });

  it("uses bike fallback for short transit routes", async () => {
    vi.spyOn(routing, "fetchRoute").mockResolvedValue({
      distanceMeters: 1800,
      durationSeconds: 8 * 60,
    });
    const fetchTransit = vi.spyOn(transitRouting, "fetchTransitJourney");

    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Test apt",
        address: "Wohnung A",
        latitude: 52.5,
        longitude: 13.4,
      },
    });
    const userAddress = await prisma.userAddress.create({
      data: {
        userId: user.id,
        label: "Arbeit",
        address: "Arbeit B",
        latitude: 52.51,
        longitude: 13.41,
      },
    });

    const legs = await computeCommuteLegs({
      apartmentId: apartment.id,
      apartment: { latitude: apartment.latitude!, longitude: apartment.longitude! },
      apartmentAddress: apartment.address,
      addresses: [
        {
          id: userAddress.id,
          label: userAddress.label,
          address: userAddress.address,
          latitude: userAddress.latitude,
          longitude: userAddress.longitude,
          isWorkplace: true,
        },
      ],
      travelMode: "transit",
      transitSettings: {
        arrivalWeekday: 1,
        arrivalHour: 8,
        arrivalMinute: 0,
        fallbackMaxKm: 5,
        fallbackMode: "bike",
      },
      companyCar: false,
      companyCarRate: null,
      listPrice: null,
      marginalTaxRatePercent: null,
      companyCarCommuteMethod: null,
      companyCarOfficeTripsPerMonth: null,
      companyCarContributionEur: null,
      companyCarSelfPaidCostsEur: null,
      companyCarEmployerFuelCard: true,
    });

    expect(legs[0]?.routingNote).toContain("Rad");
    expect(fetchTransit).not.toHaveBeenCalled();

    const cached = await prisma.commuteCache.findUnique({
      where: {
        apartmentId_userAddressId_travelMode: {
          apartmentId: apartment.id,
          userAddressId: userAddress.id,
          travelMode: "transit",
        },
      },
    });
    expect(cached?.routeKind).toBe("transit_fallback");
    expect(cached?.effectiveMode).toBe("bike");
    await prisma.$disconnect();
  });

  it("stores transit connection in cache for longer routes", async () => {
    vi.spyOn(routing, "fetchRoute").mockResolvedValue({
      distanceMeters: 12_000,
      durationSeconds: 40 * 60,
    });
    vi.spyOn(transitRouting, "fetchTransitJourney").mockResolvedValue({
      durationSeconds: 35 * 60,
      distanceMeters: 500,
      connectionSummary: "S 1 → U2",
      arrivalTargetLabel: "Ankunft Mo 08:00",
      legDetails: [
        {
          kind: "transit",
          lineName: "S 1",
          fromStop: "Bornholmer Straße",
          toStop: "Alexanderplatz",
          departureTime: "07:30",
          arrivalTime: "07:45",
          departurePlatform: "1",
          arrivalPlatform: "3",
          distanceMeters: null,
        },
        {
          kind: "transit",
          lineName: "U2",
          fromStop: "Alexanderplatz",
          toStop: "Potsdamer Platz",
          departureTime: "07:48",
          arrivalTime: "08:00",
          departurePlatform: "2",
          arrivalPlatform: "1",
          distanceMeters: null,
        },
      ],
      detailTooltip:
        "1. S 1: Bornholmer Straße Gleis 1 07:30 → Alexanderplatz Gleis 3 07:45\n2. U2: Alexanderplatz Gleis 2 07:48 → Potsdamer Platz Gleis 1 08:00",
    });

    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apartment = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Test apt",
        address: "Wohnung A",
        latitude: 52.5,
        longitude: 13.4,
      },
    });
    const userAddress = await prisma.userAddress.create({
      data: {
        userId: user.id,
        label: "Arbeit",
        address: "Arbeit B",
        latitude: 52.6,
        longitude: 13.5,
      },
    });

    const legs = await computeCommuteLegs({
      apartmentId: apartment.id,
      apartment: { latitude: apartment.latitude!, longitude: apartment.longitude! },
      apartmentAddress: apartment.address,
      addresses: [
        {
          id: userAddress.id,
          label: userAddress.label,
          address: userAddress.address,
          latitude: userAddress.latitude,
          longitude: userAddress.longitude,
          isWorkplace: true,
        },
      ],
      travelMode: "transit",
      transitSettings: {
        arrivalWeekday: 1,
        arrivalHour: 8,
        arrivalMinute: 0,
        fallbackMaxKm: 5,
        fallbackMode: "bike",
      },
      companyCar: false,
      companyCarRate: null,
      listPrice: null,
      marginalTaxRatePercent: null,
      companyCarCommuteMethod: null,
      companyCarOfficeTripsPerMonth: null,
      companyCarContributionEur: null,
      companyCarSelfPaidCostsEur: null,
      companyCarEmployerFuelCard: true,
    });

    expect(legs[0]?.connectionSummary).toContain("S 1 → U2");
    expect(legs[0]?.transitDetailTooltip).toContain("Bornholmer Straße");
    expect(legs[0]?.transitDetailTooltip).toContain("U2");
    expect(legs[0]?.routingNote).toBeNull();

    const cached = await prisma.commuteCache.findUnique({
      where: {
        apartmentId_userAddressId_travelMode: {
          apartmentId: apartment.id,
          userAddressId: userAddress.id,
          travelMode: "transit",
        },
      },
    });
    expect(cached?.routeKind).toBe("transit");
    expect(cached?.connectionSummary).toContain("S 1 → U2");
    expect(cached?.transitDetailJson).toContain("Bornholmer");
    await prisma.$disconnect();
  });

  it("cacheOnly transit pending shows auto distance while ÖPNV is backfilled", async () => {
    const fetchRoute = vi.spyOn(routing, "fetchRoute").mockResolvedValue({
      distanceMeters: 15_200,
      durationSeconds: 14 * 60,
    });
    const fetchTransit = vi.spyOn(transitRouting, "fetchTransitJourney");

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
        address: "Bremen",
        latitude: 53.1,
        longitude: 8.85,
      },
    });

    const legs = await computeCommuteLegs({
      apartmentId: apartment.id,
      apartment: { latitude: apartment.latitude!, longitude: apartment.longitude! },
      apartmentAddress: apartment.address,
      addresses: [
        {
          id: userAddress.id,
          label: userAddress.label,
          address: userAddress.address,
          latitude: userAddress.latitude,
          longitude: userAddress.longitude,
          isWorkplace: false,
        },
      ],
      travelMode: "transit",
      transitSettings: {
        arrivalWeekday: 1,
        arrivalHour: 8,
        arrivalMinute: 0,
        fallbackMaxKm: 5,
        fallbackMode: "bike",
      },
      companyCar: false,
      companyCarRate: null,
      listPrice: null,
      marginalTaxRatePercent: null,
      companyCarCommuteMethod: null,
      companyCarOfficeTripsPerMonth: null,
      companyCarContributionEur: null,
      companyCarSelfPaidCostsEur: null,
      companyCarEmployerFuelCard: true,
      cacheOnly: true,
    });

    expect(legs[0]?.distanceText).toBe("15,2 km");
    expect(legs[0]?.routingNote).toBe("Daten werden berechnet");
    expect(legs[0]?.durationText).toBeNull();
    expect(fetchRoute).toHaveBeenCalledTimes(1);
    expect(fetchRoute).toHaveBeenCalledWith(
      { latitude: apartment.latitude, longitude: apartment.longitude },
      { latitude: userAddress.latitude, longitude: userAddress.longitude },
      "driving",
      undefined
    );
    expect(fetchTransit).not.toHaveBeenCalled();

    const drivingCache = await prisma.commuteCache.findUnique({
      where: {
        apartmentId_userAddressId_travelMode: {
          apartmentId: apartment.id,
          userAddressId: userAddress.id,
          travelMode: "driving",
        },
      },
    });
    expect(drivingCache?.distanceMeters).toBe(15200);
    await prisma.$disconnect();
  });

  it("findMissingCommuteLegs lists legs without cache", async () => {
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
        address: "Bremen",
        latitude: 53.1,
        longitude: 8.85,
      },
    });

    const missing = await findMissingCommuteLegs(10);
    expect(missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          apartmentId: apartment.id,
          userAddressId: userAddress.id,
          travelMode: "driving",
        }),
      ])
    );
    await prisma.$disconnect();
  });

  it("runCommuteBackfillTick fills missing commute cache in background", async () => {
    vi.spyOn(routing, "fetchRoute").mockResolvedValue({
      distanceMeters: 7500,
      durationSeconds: 14 * 60,
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
        address: "Bremen",
        latitude: 53.1,
        longitude: 8.85,
      },
    });

    const result = await runCommuteBackfillTick(10);
    expect(result.computed).toBeGreaterThanOrEqual(1);

    const cached = await prisma.commuteCache.findUnique({
      where: {
        apartmentId_userAddressId_travelMode: {
          apartmentId: apartment.id,
          userAddressId: userAddress.id,
          travelMode: "driving",
        },
      },
    });
    expect(cached?.distanceMeters).toBe(7500);
    await prisma.$disconnect();
  });
});
