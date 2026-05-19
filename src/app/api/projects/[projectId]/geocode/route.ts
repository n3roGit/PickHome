import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      members: { some: { userId: user.id } },
    },
    include: {
      apartments: {
        where: { archivedAt: null },
        select: { id: true, title: true, address: true, latitude: true, longitude: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  for (const apt of project.apartments) {
    if (!apt.address?.trim() || (apt.latitude != null && apt.longitude != null)) {
      continue;
    }
    const coords = await geocodeAddress(apt.address);
    if (!coords) continue;
    await prisma.apartment.update({
      where: { id: apt.id },
      data: { latitude: coords.latitude, longitude: coords.longitude },
    });
    apt.latitude = coords.latitude;
    apt.longitude = coords.longitude;
    await new Promise((r) => setTimeout(r, 1100));
  }

  const updated = await prisma.apartment.findMany({
    where: { projectId: params.projectId, archivedAt: null },
    select: { id: true, title: true, address: true, latitude: true, longitude: true },
  });

  return NextResponse.json({ apartments: updated });
}
