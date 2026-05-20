import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { countMissingCommuteLegsForProject } from "@/lib/commute-backfill";
import { getProjectReindexJobs } from "@/lib/project-reindex-jobs";
import { projectAccessWhere } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const resolvedParams = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: projectAccessWhere(resolvedParams.projectId, user),
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [jobs, commutePendingLegs] = await Promise.all([
    getProjectReindexJobs(resolvedParams.projectId),
    countMissingCommuteLegsForProject(resolvedParams.projectId),
  ]);
  return NextResponse.json({ ...jobs, commutePendingLegs });
}
