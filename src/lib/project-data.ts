import { prisma } from "./prisma";
import type { CriterionInput } from "./scoring";
import {
  apartmentAccessWhere,
  apartmentInProjectAccessWhere,
  criterionGroupAccessWhere,
  projectAccessWhere,
  type ProjectAccessUser,
} from "./project-access";

export { apartmentScore } from "./scoring";
export type { CriterionInput } from "./scoring";
export type { ProjectAccessUser } from "./project-access";

export async function getProjectMetaForUser(projectId: string, user: ProjectAccessUser) {
  return prisma.project.findFirst({
    where: projectAccessWhere(projectId, user),
    include: {
      members: { include: { user: { select: { id: true, name: true, username: true } } } },
      groups: {
        orderBy: { sortOrder: "asc" },
        include: { criteria: { orderBy: { sortOrder: "asc" } } },
      },
      checklistItems: {
        orderBy: [{ criterionGroup: { sortOrder: "asc" } }, { sortOrder: "asc" }],
        include: {
          criterion: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function getProjectForUser(
  projectId: string,
  user: ProjectAccessUser,
  options?: { archived?: boolean }
) {
  const archived = options?.archived ?? false;
  return prisma.project.findFirst({
    where: projectAccessWhere(projectId, user),
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
          checklistEntries: { select: { itemId: true, status: true, note: true } },
        },
      },
    },
  });
}

export async function getApartmentForUser(
  projectId: string,
  apartmentId: string,
  user: ProjectAccessUser
) {
  return prisma.apartment.findFirst({
    where: apartmentInProjectAccessWhere(projectId, apartmentId, user),
    include: {
      ratings: true,
      photos: { orderBy: { sortOrder: "asc" } },
      documents: { orderBy: { sortOrder: "asc" } },
      viewings: { orderBy: { scheduledAt: "desc" } },
      checklistEntries: {
        include: {
          item: {
            include: {
              criterion: { select: { id: true, name: true } },
              criterionGroup: { select: { id: true, name: true, sortOrder: true } },
            },
          },
        },
      },
    },
  });
}

export async function assertProjectAccess(projectId: string, user: ProjectAccessUser) {
  return prisma.project.findFirst({
    where: projectAccessWhere(projectId, user),
    select: { id: true },
  });
}

export async function assertCriterionGroupAccess(groupId: string, user: ProjectAccessUser) {
  return prisma.criterionGroup.findFirst({
    where: criterionGroupAccessWhere(groupId, user),
    select: { id: true, projectId: true, sortOrder: true },
  });
}

export async function assertApartmentAccess(apartmentId: string, user: ProjectAccessUser) {
  return prisma.apartment.findFirst({
    where: apartmentAccessWhere(apartmentId, user),
    select: { id: true, projectId: true, latitude: true, longitude: true },
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
  await seedProjectChecklistFromCriteria(projectId);
}

export async function seedProjectChecklistFromCriteria(projectId: string) {
  const { DEFAULT_CHECKLIST_CRITERION_NAMES } = await import("./defaults");
  const groups = await prisma.criterionGroup.findMany({
    where: { projectId },
    include: { criteria: true },
  });
  let sortOrder = 0;
  for (const group of groups) {
    for (const criterion of group.criteria) {
      if (!DEFAULT_CHECKLIST_CRITERION_NAMES.has(criterion.name)) continue;
      await prisma.checklistItem.create({
        data: {
          projectId,
          criterionGroupId: group.id,
          criterionId: criterion.id,
          assigneeUserId: null,
          sortOrder: sortOrder++,
        },
      });
    }
  }
}

export async function getProjectChecklistItems(projectId: string) {
  return prisma.checklistItem.findMany({
    where: { projectId },
    orderBy: [{ criterionGroup: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: {
      criterion: { select: { id: true, name: true, weight: true, isDealbreaker: true } },
      criterionGroup: { select: { id: true, name: true, sortOrder: true, brokerQuestions: true } },
    },
  });
}

export async function getApartmentChecklistEntries(apartmentId: string) {
  return prisma.checklistEntry.findMany({
    where: { apartmentId },
    include: {
      item: {
        include: {
          criterion: { select: { id: true, name: true } },
          criterionGroup: { select: { id: true, name: true, sortOrder: true, brokerQuestions: true } },
        },
      },
    },
  });
}
