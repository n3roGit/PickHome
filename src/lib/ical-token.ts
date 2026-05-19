import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export async function ensureProjectIcalToken(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { icalToken: true },
  });
  if (project?.icalToken) return project.icalToken;

  const token = randomUUID();
  await prisma.project.update({
    where: { id: projectId },
    data: { icalToken: token },
  });
  return token;
}
