import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { parseAreaFilterConfig, isAreaFilterActive } from "@/lib/area-filter";
import { resolvePlzMapOverlays } from "@/lib/plz-map-overlays";
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
      areaFilterOrtKey: true,
      areaFilterConfig: true,
      apartments: {
        where: { archivedAt: null },
        select: { address: true, latitude: true, longitude: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const areaFilterConfig = parseAreaFilterConfig(project.areaFilterConfig);
  if (!isAreaFilterActive(project.areaFilterOrtKey, areaFilterConfig) || !areaFilterConfig) {
    return NextResponse.json({ overlays: [] });
  }

  const overlays = await resolvePlzMapOverlays(
    areaFilterConfig.selectedPlz,
    project.apartments,
    { geocode: false, merge: false }
  );

  return NextResponse.json({ overlays });
}
