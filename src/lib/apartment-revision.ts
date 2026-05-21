import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const APARTMENT_REVISION_FIELD = "revision";

export function apartmentDetailPath(projectId: string, apartmentId: string) {
  return `/project/${projectId}/apartment/${apartmentId}`;
}

export function parseExpectedRevision(formData: FormData): number | null {
  const raw = String(formData.get(APARTMENT_REVISION_FIELD) ?? "").trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function redirectApartmentRevisionConflict(
  projectId: string,
  apartmentId: string
): never {
  redirect(`${apartmentDetailPath(projectId, apartmentId)}?conflict=1`);
}

export function requireRevisionFromForm(
  formData: FormData,
  projectId: string,
  apartmentId: string
): number {
  const revision = parseExpectedRevision(formData);
  if (revision === null) {
    redirectApartmentRevisionConflict(projectId, apartmentId);
  }
  return revision;
}

export async function updateApartmentIfRevisionMatches(
  apartmentId: string,
  expectedRevision: number,
  data: Prisma.ApartmentUpdateInput
): Promise<boolean> {
  const result = await prisma.apartment.updateMany({
    where: { id: apartmentId, revision: expectedRevision },
    data: { ...data, revision: { increment: 1 } },
  });
  return result.count === 1;
}

export async function bumpApartmentRevision(apartmentId: string) {
  await prisma.apartment.update({
    where: { id: apartmentId },
    data: { revision: { increment: 1 } },
  });
}
