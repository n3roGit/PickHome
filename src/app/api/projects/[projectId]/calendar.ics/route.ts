import { NextResponse } from "next/server";
import { buildIcsCalendar } from "@/lib/ical";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const resolvedParams = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: resolvedParams.projectId, icalToken: token },
    include: {
      apartments: {
        include: {
          viewings: { orderBy: { scheduledAt: "asc" } },
        },
      },
    },
  });

  if (!project) {
    return new NextResponse("Not found", { status: 404 });
  }

  const events = project.apartments.flatMap((apt) =>
    apt.viewings.map((v) => {
      const end = new Date(v.scheduledAt.getTime() + 60 * 60 * 1000);
      return {
        uid: `pickhome-${v.id}@local`,
        start: v.scheduledAt,
        end,
        summary: `Besichtigung: ${apt.title}`,
        description: v.note ?? undefined,
        location: apt.address ?? undefined,
      };
    })
  );

  const body = buildIcsCalendar(events, `PickHome — ${project.name}`);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="pickhome-${project.name.replace(/\s+/g, "-")}.ics"`,
    },
  });
}
