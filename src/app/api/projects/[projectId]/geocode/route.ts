import { NextResponse } from "next/server";
import { enrichApartmentAddressRecord } from "@/lib/apartment-address-enrichment";
import { getSessionUser } from "@/lib/auth";
import { invalidateLocationDataForApartment } from "@/lib/location-insight-cache";
import { projectAccessWhere } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export async function POST(
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
    include: {
      apartments: {
        where: { archivedAt: null },
        select: {
          id: true,
          projectId: true,
          title: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  for (const apt of project.apartments) {
    const result = await enrichApartmentAddressRecord(apt);
    if (!result.updated) continue;
    await prisma.apartment.update({
      where: { id: apt.id },
      data: {
        address: result.address,
        latitude: result.latitude ?? undefined,
        longitude: result.longitude ?? undefined,
      },
    });
    if (result.coordsChanged) {
      await invalidateLocationDataForApartment(apt.id);
    }
  }

  const updated = await prisma.apartment.findMany({
    where: { projectId: resolvedParams.projectId, archivedAt: null },
    select: { id: true, title: true, address: true, latitude: true, longitude: true },
  });

  return NextResponse.json({ apartments: updated });
}
