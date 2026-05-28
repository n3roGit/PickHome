import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getProjectMapPoisForApartments } from "@/lib/project-map-pois";
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
    select: {
      apartments: {
        where: { archivedAt: null, latitude: { not: null }, longitude: { not: null } },
        select: { id: true, title: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const markers = await getProjectMapPoisForApartments(project.apartments);
  return NextResponse.json({ markers });
}
