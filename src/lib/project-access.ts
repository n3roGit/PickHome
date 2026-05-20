import type { Prisma } from "@prisma/client";
import { isAdmin } from "@/lib/auth";

export type ProjectAccessUser = { id: string; role: string };

export function projectAccessWhere(
  projectId: string,
  user: ProjectAccessUser
): Prisma.ProjectWhereInput {
  if (isAdmin(user)) return { id: projectId };
  return { id: projectId, members: { some: { userId: user.id } } };
}

export function activeProjectsListWhere(user: ProjectAccessUser): Prisma.ProjectWhereInput {
  if (isAdmin(user)) return { archivedAt: null };
  return { members: { some: { userId: user.id } }, archivedAt: null };
}

export function apartmentInProjectAccessWhere(
  projectId: string,
  apartmentId: string,
  user: ProjectAccessUser
): Prisma.ApartmentWhereInput {
  if (isAdmin(user)) return { id: apartmentId, projectId };
  return {
    id: apartmentId,
    projectId,
    project: { members: { some: { userId: user.id } } },
  };
}

export function apartmentAccessWhere(
  apartmentId: string,
  user: ProjectAccessUser
): Prisma.ApartmentWhereInput {
  if (isAdmin(user)) return { id: apartmentId };
  return { id: apartmentId, project: { members: { some: { userId: user.id } } } };
}

export function criterionGroupAccessWhere(
  groupId: string,
  user: ProjectAccessUser
): Prisma.CriterionGroupWhereInput {
  if (isAdmin(user)) return { id: groupId };
  return { id: groupId, project: { members: { some: { userId: user.id } } } };
}

/** Nested under `project` (e.g. counts). Admin: no membership filter. */
export function nestedProjectAccessFilter(
  user: ProjectAccessUser
): Prisma.ProjectWhereInput {
  if (isAdmin(user)) return {};
  return { members: { some: { userId: user.id } } };
}
