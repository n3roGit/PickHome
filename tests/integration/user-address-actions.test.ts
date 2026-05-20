import "../helpers/action-mocks-setup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createUserAddressAction,
  deleteUserAddressAction,
  updateTravelModeAction,
  updateUserAddressAction,
} from "@/app/actions";
import {
  catchRedirect,
  clearMockAuth,
  setMockUser,
} from "../helpers/action-mocks";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";

describe("user address and travel mode actions", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    const prisma = createTestPrisma();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearMockAuth();
    const prisma = createTestPrisma();
    await clearProjectData(prisma);
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    setMockUser(user);
    await prisma.$disconnect();
  });

  it("createUserAddressAction geocodes and assigns sortOrder", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });

    const form = new FormData();
    form.set("label", "Arbeit");
    form.set("address", "Bremen Hbf");

    const { redirect } = await catchRedirect(() => createUserAddressAction(form));
    expect(redirect).toContain("address_saved=1");

    const addr = await prisma.userAddress.findFirst({ where: { userId: user.id } });
    expect(addr?.label).toBe("Arbeit");
    expect(addr?.latitude).toBe(53.08);
    expect(addr?.sortOrder).toBe(0);
    await prisma.$disconnect();
  });

  it("updateUserAddressAction clears commute cache for address", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "A", latitude: 53.0, longitude: 8.0 },
    });
    const addr = await prisma.userAddress.create({
      data: {
        userId: user.id,
        label: "Home",
        address: "Old",
        latitude: 53.1,
        longitude: 8.9,
        sortOrder: 0,
      },
    });
    await prisma.commuteCache.create({
      data: {
        apartmentId: apt.id,
        userAddressId: addr.id,
        travelMode: "driving",
        distanceMeters: 100,
        durationSeconds: 60,
      },
    });

    const form = new FormData();
    form.set("label", "Home");
    form.set("address", "New street");

    await catchRedirect(() => updateUserAddressAction(addr.id, form));
    const cache = await prisma.commuteCache.count({ where: { userAddressId: addr.id } });
    expect(cache).toBe(0);
    await prisma.$disconnect();
  });

  it("deleteUserAddressAction removes address", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const addr = await prisma.userAddress.create({
      data: { userId: user.id, label: "X", address: "Y", sortOrder: 0 },
    });

    await catchRedirect(() => deleteUserAddressAction(addr.id));
    const gone = await prisma.userAddress.findUnique({ where: { id: addr.id } });
    expect(gone).toBeNull();
    await prisma.$disconnect();
  });

  it("updateTravelModeAction changes mode and clears user commute cache", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "A", latitude: 53, longitude: 8 },
    });
    const addr = await prisma.userAddress.create({
      data: {
        userId: user.id,
        label: "H",
        address: "Bremen",
        latitude: 53.1,
        longitude: 8.9,
      },
    });
    await prisma.commuteCache.create({
      data: {
        apartmentId: apt.id,
        userAddressId: addr.id,
        travelMode: "driving",
        distanceMeters: 200,
        durationSeconds: 120,
      },
    });

    const form = new FormData();
    form.set("travelMode", "foot");

    await catchRedirect(() => updateTravelModeAction(form));
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.travelMode).toBe("foot");
    const cache = await prisma.commuteCache.count({ where: { userAddress: { userId: user.id } } });
    expect(cache).toBe(0);
    await prisma.$disconnect();
  });
});
