import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/projects/[projectId]/calendar.ics/route";
import { ensureProjectIcalToken } from "@/lib/ical-token";
import {
  clearProjectData,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";

describe("iCal feed", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    const prisma = createTestPrisma();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const prisma = createTestPrisma();
    await clearProjectData(prisma);
    await prisma.$disconnect();
  });

  it("ensureProjectIcalToken creates stable token", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);

    const t1 = await ensureProjectIcalToken(project.id);
    const t2 = await ensureProjectIcalToken(project.id);
    expect(t1).toBe(t2);
    expect(t1.length).toBeGreaterThan(10);
    await prisma.$disconnect();
  });

  it("GET returns 400 without token", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);

    const res = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ projectId: project.id }),
    });
    expect(res.status).toBe(400);
    await prisma.$disconnect();
  });

  it("GET returns 404 for wrong token", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    await ensureProjectIcalToken(project.id);

    const res = await GET(
      new Request("http://localhost/api?token=wrong-token"),
      { params: Promise.resolve({ projectId: project.id }) }
    );
    expect(res.status).toBe(404);
    await prisma.$disconnect();
  });

  it("GET returns calendar with viewings", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: "Nice flat",
        address: "Bremen",
        notes: "Apartment notes from details",
      },
    });
    await prisma.viewingAppointment.create({
      data: {
        apartmentId: apt.id,
        scheduledAt: new Date("2026-06-01T10:00:00.000Z"),
        note: "Bring keys",
      },
    });
    const token = await ensureProjectIcalToken(project.id);

    const res = await GET(
      new Request(`http://localhost/api?token=${token}`),
      { params: Promise.resolve({ projectId: project.id }) }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:Bring keys");
    expect(body).toContain("DESCRIPTION:Apartment notes from details");
    expect(body).not.toContain("Besichtigung: Nice flat");
    await prisma.$disconnect();
  });

  it("falls back to Besichtigung title when viewing note is empty", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const apt = await prisma.apartment.create({
      data: { projectId: project.id, title: "Nice flat", notes: "Detail notes" },
    });
    await prisma.viewingAppointment.create({
      data: {
        apartmentId: apt.id,
        scheduledAt: new Date("2026-06-01T10:00:00.000Z"),
      },
    });
    const token = await ensureProjectIcalToken(project.id);

    const res = await GET(
      new Request(`http://localhost/api?token=${token}`),
      { params: Promise.resolve({ projectId: project.id }) }
    );
    const body = await res.text();
    expect(body).toContain("SUMMARY:Besichtigung: Nice flat");
    expect(body).toContain("DESCRIPTION:Detail notes");
    await prisma.$disconnect();
  });
});
