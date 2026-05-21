import { readFile } from "fs/promises";
import { assertApartmentAccess } from "@/lib/project-data";
import type { ProjectAccessUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type { ApartmentLlmContextInput } from "@/lib/apartment-llm-context";
import { publicPhotoPath } from "@/lib/pickhome-data";
import { extractPdfText } from "@/lib/pdf-text";
import { isPdfDocument } from "@/lib/pdf-reindex";
export async function getApartmentLlmBundle(
  apartmentId: string,
  user: ProjectAccessUser
): Promise<{
  projectName: string;
  apartment: ApartmentLlmContextInput;
  pdfDocuments: ApartmentPdfDocumentRow[];
} | null> {
  const access = await assertApartmentAccess(apartmentId, user);
  if (!access) return null;

  const row = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    include: {
      project: { select: { name: true } },
      documents: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          fileName: true,
          url: true,
          mimeType: true,
          extractedText: true,
        },
      },
    },
  });
  if (!row) return null;

  await loadApartmentPdfSourceText(row.documents);
  const documents = await prisma.apartmentDocument.findMany({
    where: { apartmentId },
    orderBy: { sortOrder: "asc" },
    select: { fileName: true, extractedText: true },
  });

  return {
    projectName: row.project.name,
    apartment: {
      projectName: row.project.name,
      title: row.title,
      address: row.address,
      listingUrl: row.listingUrl,
      price: row.price,
      sizeSqm: row.sizeSqm,
      floor: row.floor,
      yearBuilt: row.yearBuilt,
      energyClass: row.energyClass,
      brokerInvolved: row.brokerInvolved,
      description: row.description,
      notes: row.notes,
      documents,
    },
    pdfDocuments: row.documents,
  };
}

export type ApartmentPdfDocumentRow = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  extractedText?: string | null;
};

export function buildPdfSourceText(
  documents: { fileName: string; extractedText?: string | null }[]
): string {
  const parts: string[] = [];
  for (const doc of documents) {
    const text = doc.extractedText?.trim();
    if (!text) continue;
    parts.push(`--- ${doc.fileName} ---\n${text}`);
  }
  return parts.join("\n\n");
}

async function readPdfTextFromDisk(url: string): Promise<string | null> {
  const filePath = publicPhotoPath(url);
  if (!filePath) return null;
  try {
    const buffer = await readFile(filePath);
    return await extractPdfText(buffer);
  } catch {
    return null;
  }
}

/** Uses stored text; extracts missing PDF text from disk and persists it. */
export async function loadApartmentPdfSourceText(
  documents: ApartmentPdfDocumentRow[]
): Promise<string> {
  const parts: string[] = [];
  for (const doc of documents) {
    if (!isPdfDocument(doc.mimeType, doc.url)) continue;

    let text = doc.extractedText?.trim() ?? "";
    if (!text) {
      const extracted = await readPdfTextFromDisk(doc.url);
      if (extracted) {
        text = extracted;
        await prisma.apartmentDocument.update({
          where: { id: doc.id },
          data: { extractedText: extracted },
        });
      }
    }
    if (!text) continue;
    parts.push(`--- ${doc.fileName} ---\n${text}`);
  }
  return parts.join("\n\n");
}
