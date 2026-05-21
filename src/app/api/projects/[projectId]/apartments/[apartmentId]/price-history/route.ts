import { NextResponse } from "next/server";
import { getApartmentPriceHistory } from "@/lib/apartment-price-history";
import { getSessionUser } from "@/lib/auth";
import { apartmentInProjectAccessWhere } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; apartmentId: string }> }
) {
  const resolvedParams = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apt = await prisma.apartment.findFirst({
    where: apartmentInProjectAccessWhere(
      resolvedParams.projectId,
      resolvedParams.apartmentId,
      user
    ),
    select: { id: true },
  });

  if (!apt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const entries = await getApartmentPriceHistory(apt.id);
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      price: e.price,
      previousPrice: e.previousPrice,
      source: e.source,
      recordedAt: e.recordedAt.toISOString(),
    })),
  });
}
