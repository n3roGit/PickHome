"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseChecklistStatus } from "@/lib/checklist-display";
import { prisma } from "@/lib/prisma";
import {
  assertApartmentAccess,
  assertCriterionGroupAccess,
  assertProjectAccess,
} from "@/lib/project-data";

function revalidateChecklist(projectId: string, apartmentId?: string) {
  revalidatePath(`/project/${projectId}`, "page");
  if (apartmentId) {
    revalidatePath(`/project/${projectId}/apartment/${apartmentId}`, "page");
    revalidatePath(`/project/${projectId}/apartment/${apartmentId}/checklist`, "page");
  }
}

async function assertCriterionInProject(criterionId: string, projectId: string) {
  return prisma.criterion.findFirst({
    where: { id: criterionId, group: { projectId } },
    select: { id: true, groupId: true },
  });
}

async function assertChecklistItemAccess(itemId: string, userId: string) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { id: true, projectId: true },
  });
  if (!item) return null;
  const project = await assertProjectAccess(item.projectId, { id: userId });
  if (!project) return null;
  return item;
}

export async function toggleChecklistCriterionAction(
  projectId: string,
  criterionId: string,
  enabled: boolean
) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project) return;

  const criterion = await assertCriterionInProject(criterionId, projectId);
  if (!criterion) return;

  if (enabled) {
    const existing = await prisma.checklistItem.findUnique({
      where: { criterionId },
    });
    if (existing) return;

    const maxOrder = await prisma.checklistItem.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    await prisma.checklistItem.create({
      data: {
        projectId,
        criterionGroupId: criterion.groupId,
        criterionId,
        assigneeUserId: null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  } else {
    await prisma.checklistItem.deleteMany({ where: { criterionId } });
  }

  revalidateChecklist(projectId);
}

export async function updateChecklistItemAssigneeAction(
  itemId: string,
  assigneeUserId: string | null
) {
  const user = await requireUser();
  const item = await assertChecklistItemAccess(itemId, user.id);
  if (!item) return;

  if (assigneeUserId) {
    const member = await prisma.projectMember.findFirst({
      where: { projectId: item.projectId, userId: assigneeUserId },
    });
    if (!member) return;
  }

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: { assigneeUserId },
  });
  revalidateChecklist(item.projectId);
}

export async function updateCriterionGroupBrokerQuestionsAction(
  groupId: string,
  brokerQuestions: string
) {
  const user = await requireUser();
  const group = await assertCriterionGroupAccess(groupId, user);
  if (!group) return;

  const trimmed = brokerQuestions.trim();
  await prisma.criterionGroup.update({
    where: { id: groupId },
    data: { brokerQuestions: trimmed || null },
  });
  revalidateChecklist(group.projectId);
}

export async function addChecklistCustomItemAction(
  projectId: string,
  criterionGroupId: string,
  name: string
) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project) return;

  const group = await assertCriterionGroupAccess(criterionGroupId, user);
  if (!group || group.projectId !== projectId) return;

  const label = name.trim();
  if (!label) return;

  const maxOrder = await prisma.checklistItem.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  await prisma.checklistItem.create({
    data: {
      projectId,
      criterionGroupId,
      name: label,
      assigneeUserId: null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateChecklist(projectId);
}

export async function removeChecklistCustomItemAction(itemId: string) {
  const user = await requireUser();
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { id: true, projectId: true, criterionId: true },
  });
  if (!item || item.criterionId) return;

  const project = await assertProjectAccess(item.projectId, user);
  if (!project) return;

  await prisma.checklistItem.delete({ where: { id: itemId } });
  revalidateChecklist(item.projectId);
}

export async function saveChecklistEntryAction(
  apartmentId: string,
  itemId: string,
  status: string,
  note: string | null
) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) return;

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, projectId: apt.projectId },
    select: { id: true, assigneeUserId: true },
  });
  if (!item) return;

  if (item.assigneeUserId && item.assigneeUserId !== user.id) return;

  const parsedStatus = parseChecklistStatus(status);
  const trimmedNote = note?.trim() || null;

  await prisma.checklistEntry.upsert({
    where: { apartmentId_itemId: { apartmentId, itemId } },
    create: {
      apartmentId,
      itemId,
      status: parsedStatus,
      note: trimmedNote,
    },
    update: {
      status: parsedStatus,
      note: trimmedNote,
    },
  });

  revalidateChecklist(apt.projectId, apartmentId);
}
