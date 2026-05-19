import { prisma } from "./prisma";
import type { CriterionInput } from "./scoring";

export { apartmentScore } from "./scoring";

export type { CriterionInput } from "./scoring";

export async function getProjectMetaForUser(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      members: { some: { userId } },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, username: true } } } },
      groups: {
        orderBy: { sortOrder: "asc" },
        include: { criteria: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export async function getProjectForUser(
  projectId: string,
  userId: string,
  options?: { archived?: boolean }
) {
  const archived = options?.archived ?? false;
  return prisma.project.findFirst({
    where: {
      id: projectId,
      members: { some: { userId } },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, username: true } } } },
      groups: {
        orderBy: { sortOrder: "asc" },
        include: { criteria: { orderBy: { sortOrder: "asc" } } },
      },
      apartments: {
        where: archived ? { archivedAt: { not: null } } : { archivedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          ratings: true,
          photos: { orderBy: { sortOrder: "asc" } },
          documents: { orderBy: { sortOrder: "asc" }, select: { fileName: true, extractedText: true } },
          viewings: { orderBy: { scheduledAt: "asc" } },
        },
      },
    },
  });
}

export async function getApartmentForUser(
  projectId: string,
  apartmentId: string,
  userId: string
) {
  return prisma.apartment.findFirst({
    where: {
      id: apartmentId,
      projectId,
      project: { members: { some: { userId } } },
    },
    include: {
      ratings: true,
      photos: { orderBy: { sortOrder: "asc" } },
      documents: { orderBy: { sortOrder: "asc" } },
      viewings: { orderBy: { scheduledAt: "desc" } },
    },
  });
}

export async function assertProjectAccess(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    select: { id: true },
  });
}

export async function assertCriterionGroupAccess(groupId: string, userId: string) {
  return prisma.criterionGroup.findFirst({
    where: {
      id: groupId,
      project: { members: { some: { userId } } },
    },
    select: { id: true, projectId: true, sortOrder: true },
  });
}

export async function assertApartmentAccess(apartmentId: string, userId: string) {
  return prisma.apartment.findFirst({
    where: {
      id: apartmentId,
      project: { members: { some: { userId } } },
    },
    select: { id: true, projectId: true },
  });
}
export function flattenCriteria(
  groups: { criteria: CriterionInput[] }[]
): CriterionInput[] {
  return groups.flatMap((g) => g.criteria);
}

export async function seedProjectCriteria(projectId: string) {
  const { DEFAULT_CRITERIA_GROUPS } = await import("./defaults");
  let groupOrder = 0;
  for (const g of DEFAULT_CRITERIA_GROUPS) {
    const group = await prisma.criterionGroup.create({
      data: { projectId, name: g.name, sortOrder: groupOrder++ },
    });
    let critOrder = 0;
    for (const c of g.criteria) {
      await prisma.criterion.create({
        data: {
          groupId: group.id,
          name: c.name,
          weight: c.weight,
          isDealbreaker: c.isDealbreaker ?? false,
          sortOrder: critOrder++,
        },
      });
    }
  }
}
