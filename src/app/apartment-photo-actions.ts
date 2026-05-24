"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteApartmentPhotoFile, saveApartmentPhoto } from "@/lib/apartment-media";
import { prisma } from "@/lib/prisma";
import { assertApartmentAccess } from "@/lib/project-data";
import { isApartmentUploadError, type ApartmentUploadError } from "@/lib/upload-limits";

export type UploadApartmentFileResult =
  | { ok: true }
  | { ok: false; error: ApartmentUploadError };

function revalidateApartment(projectId: string, apartmentId: string) {
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/apartment/${apartmentId}`);
}

function uploadErrorFromCaught(e: unknown): UploadApartmentFileResult {
  if (e instanceof Error && isApartmentUploadError(e.message)) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: "invalid_type" };
}

export type UploadApartmentPhotoOptions = {
  /** When false, skip revalidate until flushApartmentPhotoRevalidateAction (batch uploads). */
  revalidate?: boolean;
};

export async function uploadApartmentPhotoAction(
  apartmentId: string,
  formData: FormData,
  options?: UploadApartmentPhotoOptions
): Promise<UploadApartmentFileResult | void> {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) return;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  const shouldRevalidate = options?.revalidate !== false;

  try {
    const { url, thumbUrl } = await saveApartmentPhoto(apartmentId, file);
    const count = await prisma.apartmentPhoto.count({ where: { apartmentId } });
    await prisma.apartmentPhoto.create({
      data: { apartmentId, url, thumbUrl, sortOrder: count },
    });
    if (shouldRevalidate) {
      revalidateApartment(apt.projectId, apartmentId);
    }
    return { ok: true };
  } catch (e) {
    return uploadErrorFromCaught(e);
  }
}

export async function flushApartmentPhotoRevalidateAction(apartmentId: string) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) return;
  revalidateApartment(apt.projectId, apartmentId);
}

export async function deleteApartmentPhotoAction(photoId: string) {
  const user = await requireUser();
  const photo = await prisma.apartmentPhoto.findUnique({
    where: { id: photoId },
    include: { apartment: { select: { id: true, projectId: true } } },
  });
  if (!photo) return;
  const apt = await assertApartmentAccess(photo.apartmentId, user);
  if (!apt) return;

  await deleteApartmentPhotoFile(photo.url, photo.thumbUrl);
  await prisma.apartmentPhoto.delete({ where: { id: photoId } });
  revalidateApartment(photo.apartment.projectId, photo.apartmentId);
}
