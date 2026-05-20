import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getProjectReindexJobs,
  resetProjectReindexJobStateForTests,
  startProjectReindexJob,
} from "@/lib/project-reindex-jobs";
import { resetTestDatabase } from "../helpers/test-db";

describe("project reindex jobs", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    resetProjectReindexJobStateForTests();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("starts documents reindex in background and completes", async () => {
    const project = await prisma.project.create({
      data: { name: "Reindex Test" },
    });

    await startProjectReindexJob(project.id, "documents");

    const deadline = Date.now() + 10_000;
    let jobs = await getProjectReindexJobs(project.id);
    while (jobs.documents?.status === "running" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      jobs = await getProjectReindexJobs(project.id);
    }

    expect(jobs.documents?.status).toBe("completed");
    expect(jobs.documents?.documentsResult).toEqual({
      processed: 0,
      withText: 0,
      withoutText: 0,
      missingFile: 0,
    });
  });

  it("rejects duplicate running jobs", async () => {
    const project = await prisma.project.create({
      data: { name: "Duplicate Reindex Test" },
    });

    await prisma.projectReindexJob.create({
      data: {
        projectId: project.id,
        kind: "commute",
        status: "running",
      },
    });

    await expect(startProjectReindexJob(project.id, "commute")).rejects.toThrow(
      "reindex_already_running"
    );
  });
});
