"use server";

import { rm } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  destroySession,
  getSessionUser,
  hashPassword,
  isAdmin,
  requireAdmin,
  requireUser,
  ROLE_USER,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteApartmentPhotoFile,
  saveApartmentDocument,
  saveApartmentPhoto,
} from "@/lib/apartment-media";
import { extractPdfText } from "@/lib/pdf-text";
import { geocodeAddress } from "@/lib/geocode";
import { normalizeListingUrl } from "@/lib/listing-url";
import { readPasswordPair } from "@/lib/password";
import { getApartmentUploadsRoot } from "@/lib/pickhome-data";
import { join } from "path";
import {
  assertApartmentAccess,
  assertCriterionGroupAccess,
  assertProjectAccess,
  seedProjectCriteria,
} from "@/lib/project-data";
import { parseBrokerBuyerRatePercent, parseFederalStateCode, parseInterestRatePercent, parsePositiveInt } from "@/lib/purchase-costs";
import { parseDealbreakerThreshold } from "@/lib/scoring";
import { syncApartmentViewedAt } from "@/lib/viewings";
import { parseTravelMode } from "@/lib/travel-mode";
import { isApartmentUploadError, type ApartmentUploadError } from "@/lib/upload-limits";

export type UploadApartmentFileResult =
  | { ok: true }
  | { ok: false; error: ApartmentUploadError };

function revalidateApartment(projectId: string, apartmentId: string) {
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/apartment/${apartmentId}`);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function deleteProjectAction(projectId: string) {
  const user = await requireUser();
  if (isAdmin(user)) redirect("/admin");

  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId: user.id } } },
    include: { apartments: { select: { id: true } } },
  });
  if (!project) redirect("/dashboard");

  for (const apt of project.apartments) {
    try {
      await rm(join(getApartmentUploadsRoot(), apt.id), {
        recursive: true,
        force: true,
      });
    } catch {
      // upload folder may not exist
    }
  }

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  if (isAdmin(user)) redirect("/admin");
  const name = String(formData.get("name") ?? "").trim();
  const budgetRaw = String(formData.get("budget") ?? "").trim();
  if (!name) return;
  const budget = budgetRaw ? parseInt(budgetRaw.replace(/\D/g, ""), 10) : null;
  const project = await prisma.project.create({
    data: {
      name,
      budget: Number.isFinite(budget) ? budget : null,
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
  await seedProjectCriteria(project.id);
  revalidatePath("/dashboard");
  redirect(`/project/${project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  if (isAdmin(user)) redirect("/admin");

  const base = `/project/${projectId}?tab=settings`;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`${base}&settings_error=name`);

  const budgetRaw = String(formData.get("budget") ?? "").trim();
  const budget = budgetRaw ? parseInt(budgetRaw.replace(/\D/g, ""), 10) : null;
  const federalStateCode = parseFederalStateCode(
    String(formData.get("federalStateCode") ?? "")
  );
  const brokerBuyerRate = parseBrokerBuyerRatePercent(
    String(formData.get("brokerBuyerRate") ?? "")
  );
  const equityAmountRaw = String(formData.get("equityAmount") ?? "").trim();
  const equityAmount = equityAmountRaw
    ? parseInt(equityAmountRaw.replace(/\D/g, ""), 10)
    : null;
  const loanTermYears = parsePositiveInt(String(formData.get("loanTermYears") ?? ""));
  const interestRate = parseInterestRatePercent(String(formData.get("interestRate") ?? ""));
  const netIncomeRaw = String(formData.get("netHouseholdIncome") ?? "").trim();
  const netHouseholdIncome = netIncomeRaw
    ? parseInt(netIncomeRaw.replace(/\D/g, ""), 10)
    : null;
  const dealbreakerThreshold = parseDealbreakerThreshold(
    String(formData.get("dealbreakerThreshold") ?? "")
  );

  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId: user.id } } },
  });
  if (!project) redirect("/dashboard");

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      budget: Number.isFinite(budget) ? budget : null,
      federalStateCode,
      brokerBuyerRate,
      equityAmount: Number.isFinite(equityAmount) ? equityAmount : null,
      loanTermYears,
      interestRate,
      netHouseholdIncome: Number.isFinite(netHouseholdIncome) ? netHouseholdIncome : null,
      dealbreakerThreshold,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/project/${projectId}`);
  redirect(`${base}&settings_saved=1`);
}

export async function reindexProjectDocumentsAction(projectId: string) {
  const user = await requireUser();
  if (isAdmin(user)) redirect("/admin");

  const project = await assertProjectAccess(projectId, user.id);
  if (!project) redirect("/dashboard");

  const { reindexProjectPdfDocuments } = await import("@/lib/pdf-reindex");
  const result = await reindexProjectPdfDocuments(projectId);

  revalidatePath(`/project/${projectId}`);
  const base = `/project/${projectId}?tab=settings`;
  const params = new URLSearchParams({
    reindex_processed: String(result.processed),
    reindex_text: String(result.withText),
    reindex_empty: String(result.withoutText),
    reindex_missing: String(result.missingFile),
  });
  redirect(`${base}&${params.toString()}`);
}

export async function archiveApartmentAction(apartmentId: string) {
  const user = await requireUser();
  const apt = await prisma.apartment.findFirst({
    where: {
      id: apartmentId,
      project: { members: { some: { userId: user.id } } },
    },
  });
  if (!apt) return;
  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { archivedAt: new Date() },
  });
  revalidatePath(`/project/${apt.projectId}`);
  revalidatePath(`/project/${apt.projectId}/apartment/${apartmentId}`);
}

export async function unarchiveApartmentAction(apartmentId: string) {
  const user = await requireUser();
  const apt = await prisma.apartment.findFirst({
    where: {
      id: apartmentId,
      project: { members: { some: { userId: user.id } } },
    },
  });
  if (!apt) return;
  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { archivedAt: null },
  });
  revalidatePath(`/project/${apt.projectId}`);
  revalidatePath(`/project/${apt.projectId}/apartment/${apartmentId}`);
}

export async function deleteApartmentAction(apartmentId: string) {
  const user = await requireUser();
  const apt = await prisma.apartment.findFirst({
    where: {
      id: apartmentId,
      project: { members: { some: { userId: user.id } } },
    },
    select: { id: true, projectId: true, archivedAt: true },
  });
  if (!apt) redirect("/dashboard");

  try {
    await rm(join(getApartmentUploadsRoot(), apt.id), {
      recursive: true,
      force: true,
    });
  } catch {
    // upload folder may not exist
  }

  await prisma.apartment.delete({ where: { id: apartmentId } });
  revalidatePath(`/project/${apt.projectId}`);
  redirect(apt.archivedAt ? `/project/${apt.projectId}?tab=archived` : `/project/${apt.projectId}`);
}

export async function createApartmentAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user.id);
  if (!project) redirect("/dashboard");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? parseInt(priceRaw.replace(/\D/g, ""), 10) : null;
  const address = String(formData.get("address") ?? "").trim() || null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (address) {
    const coords = await geocodeAddress(address);
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
  }

  const brokerInvolved = formData.get("brokerInvolved") === "on";

  await prisma.apartment.create({
    data: {
      projectId,
      title,
      address,
      latitude,
      longitude,
      price: Number.isFinite(price) ? price : null,
      brokerInvolved,
      sizeSqm: parseInt(String(formData.get("sizeSqm") ?? ""), 10) || null,
      listingUrl: normalizeListingUrl(String(formData.get("listingUrl") ?? "")),
    },
  });
  revalidatePath(`/project/${projectId}`);
}

export async function updateApartmentBrokerAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user.id);
  if (!apt) redirect("/dashboard");

  const brokerInvolved = formData.get("brokerInvolved") === "on";

  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { brokerInvolved },
  });
  revalidateApartment(apt.projectId, apartmentId);
}

export async function updateApartmentListingUrlAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user.id);
  if (!apt) redirect("/dashboard");

  const raw = String(formData.get("listingUrl") ?? "");
  const listingUrl = normalizeListingUrl(raw);
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;

  if (raw.trim() && !listingUrl) {
    redirect(`${base}?listing_error=invalid`);
  }

  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { listingUrl },
  });
  revalidateApartment(apt.projectId, apartmentId);
  redirect(`${base}?listing_saved=1`);
}

export async function updateApartmentNotesAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user.id);
  if (!apt) redirect("/dashboard");

  const raw = String(formData.get("notes") ?? "");
  const notes = raw.trim() || null;
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;

  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { notes },
  });
  revalidateApartment(apt.projectId, apartmentId);
  redirect(`${base}?notes_saved=1`);
}

export async function updateApartmentDescriptionAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user.id);
  if (!apt) redirect("/dashboard");

  const raw = String(formData.get("description") ?? "");
  const description = raw.trim() || null;
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;

  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { description },
  });
  revalidateApartment(apt.projectId, apartmentId);
  redirect(`${base}?description_saved=1`);
}

function uploadErrorFromCaught(e: unknown): UploadApartmentFileResult {
  if (e instanceof Error && isApartmentUploadError(e.message)) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: "invalid_type" };
}

export async function uploadApartmentPhotoAction(
  apartmentId: string,
  formData: FormData
): Promise<UploadApartmentFileResult | void> {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user.id);
  if (!apt) return;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  try {
    const url = await saveApartmentPhoto(apartmentId, file);
    const count = await prisma.apartmentPhoto.count({ where: { apartmentId } });
    await prisma.apartmentPhoto.create({
      data: { apartmentId, url, sortOrder: count },
    });
    revalidateApartment(apt.projectId, apartmentId);
    return { ok: true };
  } catch (e) {
    return uploadErrorFromCaught(e);
  }
}

export async function uploadApartmentDocumentAction(
  apartmentId: string,
  formData: FormData
): Promise<UploadApartmentFileResult | void> {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user.id);
  if (!apt) return;

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractPdfText(buffer);
    const saved = await saveApartmentDocument(apartmentId, file, buffer);
    const count = await prisma.apartmentDocument.count({ where: { apartmentId } });
    await prisma.apartmentDocument.create({
      data: {
        apartmentId,
        fileName: saved.fileName,
        url: saved.url,
        mimeType: saved.mimeType,
        kind: "expose",
        extractedText,
        sortOrder: count,
      },
    });
    revalidateApartment(apt.projectId, apartmentId);
    return { ok: true };
  } catch (e) {
    return uploadErrorFromCaught(e);
  }
}

export async function deleteApartmentDocumentAction(documentId: string) {
  const user = await requireUser();
  const doc = await prisma.apartmentDocument.findUnique({
    where: { id: documentId },
    include: { apartment: { select: { id: true, projectId: true } } },
  });
  if (!doc) return;
  const apt = await assertApartmentAccess(doc.apartmentId, user.id);
  if (!apt) return;

  await deleteApartmentPhotoFile(doc.url);
  await prisma.apartmentDocument.delete({ where: { id: documentId } });
  revalidateApartment(doc.apartment.projectId, doc.apartmentId);
}

export async function deleteApartmentPhotoAction(photoId: string) {
  const user = await requireUser();
  const photo = await prisma.apartmentPhoto.findUnique({
    where: { id: photoId },
    include: { apartment: { select: { id: true, projectId: true } } },
  });
  if (!photo) return;
  const apt = await assertApartmentAccess(photo.apartmentId, user.id);
  if (!apt) return;

  await deleteApartmentPhotoFile(photo.url);
  await prisma.apartmentPhoto.delete({ where: { id: photoId } });
  revalidateApartment(photo.apartment.projectId, photo.apartmentId);
}

export async function addViewingAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user.id);
  if (!apt) return;

  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return;

  const note = String(formData.get("note") ?? "").trim() || null;
  await prisma.viewingAppointment.create({
    data: { apartmentId, scheduledAt, note },
  });
  await syncApartmentViewedAt(apartmentId);
  revalidateApartment(apt.projectId, apartmentId);
}

export async function updateViewingAction(viewingId: string, formData: FormData) {
  const user = await requireUser();
  const viewing = await prisma.viewingAppointment.findUnique({
    where: { id: viewingId },
    include: { apartment: { select: { id: true, projectId: true } } },
  });
  if (!viewing) return;
  const apt = await assertApartmentAccess(viewing.apartmentId, user.id);
  if (!apt) return;

  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return;

  const note = String(formData.get("note") ?? "").trim() || null;
  await prisma.viewingAppointment.update({
    where: { id: viewingId },
    data: { scheduledAt, note },
  });
  await syncApartmentViewedAt(viewing.apartmentId);
  revalidateApartment(viewing.apartment.projectId, viewing.apartmentId);
}

export async function deleteViewingAction(viewingId: string) {
  const user = await requireUser();
  const viewing = await prisma.viewingAppointment.findUnique({
    where: { id: viewingId },
    include: { apartment: { select: { id: true, projectId: true } } },
  });
  if (!viewing) return;
  const apt = await assertApartmentAccess(viewing.apartmentId, user.id);
  if (!apt) return;

  await prisma.viewingAppointment.delete({ where: { id: viewingId } });
  await syncApartmentViewedAt(viewing.apartmentId);
  revalidateApartment(viewing.apartment.projectId, viewing.apartmentId);
}

export async function saveRatingAction(
  apartmentId: string,
  criterionId: string,
  score: number,
  note?: string | null
) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user.id);
  if (!apt) return;
  if (!Number.isInteger(score) || score < 0 || score > 10) return;

  const criterion = await prisma.criterion.findFirst({
    where: { id: criterionId, group: { projectId: apt.projectId } },
    select: { id: true },
  });
  if (!criterion) return;

  await prisma.rating.upsert({
    where: {
      apartmentId_criterionId_userId: {
        apartmentId,
        criterionId,
        userId: user.id,
      },
    },
    create: { apartmentId, criterionId, userId: user.id, score, note: note ?? null },
    update: { score, note: note ?? null },
  });
  revalidatePath(`/project/${apt.projectId}/apartment/${apartmentId}`);
  revalidatePath(`/project/${apt.projectId}`);
}

export async function updateCriterionAction(
  criterionId: string,
  data: { weight?: number; isDealbreaker?: boolean; name?: string }
) {
  const user = await requireUser();
  const c = await prisma.criterion.findUnique({
    where: { id: criterionId },
    include: { group: true },
  });
  if (!c) return;
  const group = await assertCriterionGroupAccess(c.groupId, user.id);
  if (!group) return;

  const update: typeof data = {};
  if (data.weight !== undefined) {
    if (!Number.isInteger(data.weight) || data.weight < 1 || data.weight > 5) return;
    update.weight = data.weight;
  }
  if (data.isDealbreaker !== undefined) update.isDealbreaker = data.isDealbreaker;
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) return;
    update.name = name;
  }

  await prisma.criterion.update({ where: { id: criterionId }, data: update });
  revalidatePath(`/project/${c.group.projectId}`);
}

export async function addProjectMemberAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const base = `/project/${projectId}?tab=team`;
  if (!username) redirect(base);

  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId: user.id } } },
  });
  if (!project) redirect("/dashboard");

  const invitee = await prisma.user.findUnique({ where: { username } });
  if (!invitee || isAdmin(invitee)) {
    redirect(`${base}&member_error=not_found`);
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: invitee.id } },
  });
  if (existing) {
    redirect(`${base}&member_error=already_member`);
  }

  await prisma.projectMember.create({
    data: { projectId, userId: invitee.id, role: "partner" },
  });
  revalidatePath(`/project/${projectId}`);
  redirect(`${base}&member_added=${encodeURIComponent(invitee.name)}`);
}

export async function removeProjectMemberAction(projectId: string, memberUserId: string) {
  const user = await requireUser();
  const base = `/project/${projectId}?tab=team`;

  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId: user.id } } },
  });
  if (!project) redirect("/dashboard");

  const memberCount = await prisma.projectMember.count({ where: { projectId } });
  if (memberCount <= 1) {
    redirect(`${base}&member_error=last_member`);
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: memberUserId } },
    include: { user: { select: { name: true } } },
  });
  if (!membership) redirect(base);

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId: memberUserId } },
  });
  revalidatePath(`/project/${projectId}`);

  if (memberUserId === user.id) {
    redirect("/dashboard");
  }
  redirect(`${base}&member_removed=${encodeURIComponent(membership.user.name)}`);
}

export async function addCriterionAction(projectId: string, groupId: string, name: string) {
  const user = await requireUser();
  const group = await assertCriterionGroupAccess(groupId, user.id);
  if (!group || !name.trim()) return;
  const max = await prisma.criterion.aggregate({
    where: { groupId },
    _max: { sortOrder: true },
  });
  await prisma.criterion.create({
    data: { groupId, name: name.trim(), sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  revalidatePath(`/project/${projectId}`);
}

export async function createCriterionGroupAction(projectId: string, name: string) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user.id);
  if (!project || !name.trim()) return;
  const max = await prisma.criterionGroup.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  await prisma.criterionGroup.create({
    data: {
      projectId,
      name: name.trim(),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/project/${projectId}`);
}

export async function updateCriterionGroupAction(groupId: string, name: string) {
  const user = await requireUser();
  const group = await assertCriterionGroupAccess(groupId, user.id);
  if (!group || !name.trim()) return;
  await prisma.criterionGroup.update({
    where: { id: groupId },
    data: { name: name.trim() },
  });
  revalidatePath(`/project/${group.projectId}`);
}

export async function deleteCriterionGroupAction(groupId: string) {
  const user = await requireUser();
  const group = await assertCriterionGroupAccess(groupId, user.id);
  if (!group) return;
  await prisma.criterionGroup.delete({ where: { id: groupId } });
  revalidatePath(`/project/${group.projectId}`);
}

export async function reorderCriterionGroupsAction(projectId: string, orderedIds: string[]) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user.id);
  if (!project || orderedIds.length === 0) return;

  const existing = await prisma.criterionGroup.findMany({
    where: { projectId },
    select: { id: true },
  });
  if (orderedIds.length !== existing.length) return;
  const idSet = new Set(existing.map((g) => g.id));
  if (!orderedIds.every((id) => idSet.has(id))) return;

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.criterionGroup.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );
  revalidatePath(`/project/${projectId}`);
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const pair = readPasswordPair(formData, "newPassword", "newPasswordConfirm");
  if (!pair.ok) {
    redirect(`/account/settings?error=${pair.error}`);
  }

  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, fresh.passwordHash))) {
    redirect("/account/settings?error=bad_current_password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(pair.password) },
  });
  revalidatePath("/account/settings");
  redirect("/account/settings?password_changed=1");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const pair = readPasswordPair(formData);
  if (!username || !name) {
    redirect("/admin?error=fields");
  }
  if (!pair.ok) {
    redirect(`/admin?error=${pair.error}`);
  }
  const password = pair.password;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) redirect("/admin?error=exists");
  await prisma.user.create({
    data: {
      username,
      name,
      passwordHash: await hashPassword(password),
      role: ROLE_USER,
    },
  });
  revalidatePath("/admin");
  redirect("/admin?created=1");
}

export async function deleteUserAction(userId: string) {
  const admin = await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.id === admin.id) return;
  if (isAdmin(target)) {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) redirect("/admin?error=lastadmin");
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
}

export async function updateTravelModeAction(formData: FormData) {
  const user = await requireUser();
  const travelMode = parseTravelMode(String(formData.get("travelMode") ?? ""));

  await prisma.user.update({
    where: { id: user.id },
    data: { travelMode },
  });
  revalidatePath("/account/settings");
  redirect("/account/settings?commute_saved=1");
}

async function geocodeUserAddressFields(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return { address: "", latitude: null as number | null, longitude: null as number | null };
  const coords = await geocodeAddress(trimmed);
  return {
    address: trimmed,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  };
}

export async function createUserAddressAction(formData: FormData) {
  const user = await requireUser();
  const label = String(formData.get("label") ?? "").trim();
  const rawAddress = String(formData.get("address") ?? "").trim();
  if (!label) redirect("/account/settings?error=label");
  if (!rawAddress) redirect("/account/settings?error=address");

  const geocoded = await geocodeUserAddressFields(rawAddress);
  const maxOrder = await prisma.userAddress.aggregate({
    where: { userId: user.id },
    _max: { sortOrder: true },
  });

  await prisma.userAddress.create({
    data: {
      userId: user.id,
      label,
      address: geocoded.address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/account/settings");
  redirect("/account/settings?address_saved=1");
}

export async function updateUserAddressAction(addressId: string, formData: FormData) {
  const user = await requireUser();
  const existing = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!existing) redirect("/account/settings");

  const label = String(formData.get("label") ?? "").trim();
  const rawAddress = String(formData.get("address") ?? "").trim();
  if (!label) redirect("/account/settings?error=label");
  if (!rawAddress) redirect("/account/settings?error=address");

  const geocoded = await geocodeUserAddressFields(rawAddress);

  await prisma.userAddress.update({
    where: { id: addressId },
    data: {
      label,
      address: geocoded.address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    },
  });
  revalidatePath("/account/settings");
  redirect("/account/settings?address_saved=1");
}

export async function deleteUserAddressAction(addressId: string) {
  const user = await requireUser();
  const existing = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!existing) redirect("/account/settings");

  await prisma.userAddress.delete({ where: { id: addressId } });
  revalidatePath("/account/settings");
  redirect("/account/settings?address_deleted=1");
}

export async function resetUserPasswordAction(userId: string, formData: FormData) {
  await requireAdmin();
  const pair = readPasswordPair(formData);
  if (!pair.ok) {
    redirect(`/admin?error=${pair.error}`);
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) redirect("/admin");
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(pair.password) },
  });
  revalidatePath("/admin");
  redirect(`/admin?password_reset=${encodeURIComponent(target.username)}`);
}
