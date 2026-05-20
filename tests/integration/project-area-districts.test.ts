import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  resetTestDatabase,
  createTestPrisma,
  createTestProject,
} from "../helpers/test-db";

describe("project area districts integration", () => {
  let prisma: PrismaClient;
  let projectId: string;

  beforeAll(async () => {
    await resetTestDatabase();
    prisma = createTestPrisma();
    const user = await prisma.user.findFirstOrThrow();
    const project = await createTestProject(prisma, user.id);
    projectId = project.id;
  }, 15000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores custom districts per project and PLZ", async () => {
    await prisma.projectAreaDistrict.createMany({
      data: [
        { projectId, plz: "28203", name: "Fesenfeld" },
        { projectId, plz: "28203", name: "Ostertor" },
      ],
    });

    const { fetchProjectAreaDistricts } = await import("@/lib/project-area-data");
    const byPlz = await fetchProjectAreaDistricts(projectId);

    expect(byPlz["28203"]).toEqual(["Fesenfeld", "Ostertor"]);
  });

  it("imports district rows from parsed catalog", async () => {
    const { parseLocationCatalogImport } = await import("@/lib/location-catalog-import");
    const { replaceProjectAreaDistrictsFromImport, fetchProjectAreaDistricts } = await import(
      "@/lib/project-area-data"
    );

    const parsed = parseLocationCatalogImport(
      "28205 | Bremen | Findorff, Walle",
      "Bremen"
    );
    expect(parsed).not.toBeNull();

    await replaceProjectAreaDistrictsFromImport(projectId, parsed!.rows);
    const byPlz = await fetchProjectAreaDistricts(projectId);
    expect(byPlz["28205"]).toEqual(["Findorff", "Walle"]);
  });

  it("replace import clears districts removed from text", async () => {
    const { replaceProjectAreaDistrictsFromImport, fetchProjectAreaDistricts } = await import(
      "@/lib/project-area-data"
    );

    await replaceProjectAreaDistrictsFromImport(projectId, [
      { plz: "28203", districts: ["Fesenfeld", "Ostertor"] },
      { plz: "28205", districts: ["Findorff"] },
    ]);
    await replaceProjectAreaDistrictsFromImport(projectId, [
      { plz: "28203", districts: ["Fesenfeld"] },
    ]);

    const byPlz = await fetchProjectAreaDistricts(projectId);
    expect(byPlz["28203"]).toEqual(["Fesenfeld"]);
    expect(byPlz["28205"]).toBeUndefined();
  });
});
