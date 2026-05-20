import "../helpers/action-mocks-setup";
import { access } from "fs/promises";
import { join } from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  archiveApartmentAction,
  createApartmentAction,
  deleteApartmentAction,
  unarchiveApartmentAction,
  updateApartmentBasicsAction,
} from "@/app/actions";
import { getApartmentUploadsRoot } from "@/lib/pickhome-data";
import { saveApartmentPhoto } from "@/lib/apartment-media";
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
  withIsolatedDataDir,
} from "../helpers/test-db";

describe("apartment server actions", () => {
  let dataDir: ReturnType<typeof withIsolatedDataDir>;

  beforeAll(async () => {
    await resetTestDatabase();
    dataDir = withIsolatedDataDir();
  });

  afterAll(async () => {
    dataDir.restore();
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

  it("createApartmentAction stores geocoded coordinates", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);

    const form = new FormData();
    form.set("title", "Neue Wohnung");
    form.set("address", "Bremen Mitte");
    form.set("price", "250000");

    await createApartmentAction(project.id, form);

    const apt = await prisma.apartment.findFirst({ where: { projectId: project.id } });
    expect(apt?.title).toBe("Neue Wohnung");
    expect(apt?.latitude).toBe(53.08);
    expect(apt?.longitude).toBe(8.8);
    await prisma.$disconnect();
  });

  it("updateApartmentBasicsAction updates fields and clears commute cache", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Apt",
        latitude: 53.0,
        longitude: 8.0,
      },
    });
    const addr = await prisma.userAddress.create({
      data: {
        userId: user.id,
        label: "Work",
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
        distanceMeters: 1000,
        durationSeconds: 120,
      },
    });

    const form = new FormData();
    form.set("price", "400000");
    form.set("address", "Neue Adresse");

    const { redirect: url } = await catchRedirect(() =>
      updateApartmentBasicsAction(apt.id, form)
    );
    expect(url).toContain("basics_saved=1");

    const updated = await prisma.apartment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(updated.price).toBe(400000);
    expect(updated.latitude).toBe(53.08);
    const cacheCount = await prisma.commuteCache.count({ where: { apartmentId: apt.id } });
    expect(cacheCount).toBe(0);
    await prisma.$disconnect();
  });

  it("archive and unarchive toggle archivedAt", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Archive me" },
    });

    await archiveApartmentAction(apt.id);
    let row = await prisma.apartment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(row.archivedAt).not.toBeNull();

    await unarchiveApartmentAction(apt.id);
    row = await prisma.apartment.findUniqueOrThrow({ where: { id: apt.id } });
    expect(row.archivedAt).toBeNull();
    await prisma.$disconnect();
  });

  it("deleteApartmentAction removes apartment and upload folder", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Delete me" },
    });
    const file = new File([Buffer.from("x")], "p.jpg", { type: "image/jpeg" });
    await saveApartmentPhoto(apt.id, file);

    const { redirect: url } = await catchRedirect(() => deleteApartmentAction(apt.id));
    expect(url).toContain(`/project/${project.id}`);

    const gone = await prisma.apartment.findUnique({ where: { id: apt.id } });
    expect(gone).toBeNull();
    await expect(access(join(getApartmentUploadsRoot(), apt.id))).rejects.toThrow();
    await prisma.$disconnect();
  });
});
