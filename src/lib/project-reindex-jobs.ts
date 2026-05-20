import type { ReindexProjectCommuteResult } from "@/lib/commute-reindex";
import type { ReindexProjectDocumentsResult } from "@/lib/pdf-reindex";
import { prisma } from "@/lib/prisma";

export type ProjectReindexJobKind = "documents" | "commute";
export type ProjectReindexJobStatus = "running" | "completed" | "failed";

export type ProjectReindexJobView = {
  id: string;
  kind: ProjectReindexJobKind;
  status: ProjectReindexJobStatus;
  startedAt: string;
  finishedAt: string | null;
  documentsResult: ReindexProjectDocumentsResult | null;
  commuteResult: ReindexProjectCommuteResult | null;
  errorMessage: string | null;
};

const RECENT_RESULT_MS = 30 * 60 * 1000;
const STALE_JOB_MS = 60 * 60 * 1000;
const inProcessLocks = new Set<string>();

function lockKey(projectId: string, kind: ProjectReindexJobKind) {
  return `${projectId}:${kind}`;
}

function parseDocumentsResult(raw: string | null): ReindexProjectDocumentsResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReindexProjectDocumentsResult;
  } catch {
    return null;
  }
}

function parseCommuteResult(raw: string | null): ReindexProjectCommuteResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReindexProjectCommuteResult;
  } catch {
    return null;
  }
}

function toJobView(job: {
  id: string;
  kind: string;
  status: string;
  resultJson: string | null;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): ProjectReindexJobView {
  const kind = job.kind as ProjectReindexJobKind;
  return {
    id: job.id,
    kind,
    status: job.status as ProjectReindexJobStatus,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    documentsResult: kind === "documents" ? parseDocumentsResult(job.resultJson) : null,
    commuteResult: kind === "commute" ? parseCommuteResult(job.resultJson) : null,
    errorMessage: job.errorMessage,
  };
}

async function recoverStaleJobs(projectId: string, kind: ProjectReindexJobKind) {
  const staleBefore = new Date(Date.now() - STALE_JOB_MS);
  await prisma.projectReindexJob.updateMany({
    where: {
      projectId,
      kind,
      status: "running",
      startedAt: { lt: staleBefore },
    },
    data: {
      status: "failed",
      errorMessage: "stale",
      finishedAt: new Date(),
    },
  });
}

async function executeProjectReindexJob(jobId: string, key: string) {
  try {
    const job = await prisma.projectReindexJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "running") return;

    const result =
      job.kind === "documents"
        ? await (await import("@/lib/pdf-reindex")).reindexProjectPdfDocuments(job.projectId)
        : await (await import("@/lib/commute-reindex")).reindexProjectCommute(job.projectId);

    await prisma.projectReindexJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        resultJson: JSON.stringify(result),
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Project reindex job failed:", err);
    await prisma.projectReindexJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "unknown",
        finishedAt: new Date(),
      },
    });
  } finally {
    inProcessLocks.delete(key);
  }
}

export async function startProjectReindexJob(
  projectId: string,
  kind: ProjectReindexJobKind
): Promise<string> {
  const key = lockKey(projectId, kind);
  if (inProcessLocks.has(key)) {
    throw new Error("reindex_already_running");
  }

  await recoverStaleJobs(projectId, kind);

  const existing = await prisma.projectReindexJob.findFirst({
    where: { projectId, kind, status: "running" },
  });
  if (existing) {
    throw new Error("reindex_already_running");
  }

  const job = await prisma.projectReindexJob.create({
    data: { projectId, kind, status: "running" },
  });

  inProcessLocks.add(key);
  void executeProjectReindexJob(job.id, key);
  return job.id;
}

async function latestJobForKind(projectId: string, kind: ProjectReindexJobKind) {
  const running = await prisma.projectReindexJob.findFirst({
    where: { projectId, kind, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (running) return running;

  const recentCutoff = new Date(Date.now() - RECENT_RESULT_MS);
  return prisma.projectReindexJob.findFirst({
    where: {
      projectId,
      kind,
      status: { in: ["completed", "failed"] },
      finishedAt: { gte: recentCutoff },
    },
    orderBy: { finishedAt: "desc" },
  });
}

export async function getProjectReindexJobs(projectId: string): Promise<{
  documents: ProjectReindexJobView | null;
  commute: ProjectReindexJobView | null;
}> {
  const [documents, commute] = await Promise.all([
    latestJobForKind(projectId, "documents"),
    latestJobForKind(projectId, "commute"),
  ]);

  return {
    documents: documents ? toJobView(documents) : null,
    commute: commute ? toJobView(commute) : null,
  };
}

export function resetProjectReindexJobStateForTests() {
  inProcessLocks.clear();
}
