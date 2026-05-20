import { readFile } from "fs/promises";
import { backgroundThrottlePause } from "@/lib/background-task";
import { prisma } from "@/lib/prisma";
import { publicPhotoPath } from "@/lib/pickhome-data";
import { extractPdfText } from "@/lib/pdf-text";

export type ReindexProjectDocumentsResult = {
  processed: number;
  withText: number;
  withoutText: number;
  missingFile: number;
};

export function isPdfDocument(mimeType: string, url: string): boolean {
  return mimeType === "application/pdf" || url.toLowerCase().endsWith(".pdf");
}

export async function reindexProjectPdfDocuments(
  projectId: string
): Promise<ReindexProjectDocumentsResult> {
  const documents = await prisma.apartmentDocument.findMany({
    where: { apartment: { projectId } },
    select: { id: true, url: true, mimeType: true },
  });

  const pdfDocuments = documents.filter((doc) => isPdfDocument(doc.mimeType, doc.url));
  let withText = 0;
  let withoutText = 0;
  let missingFile = 0;

  for (const doc of pdfDocuments) {
    const filePath = publicPhotoPath(doc.url);
    if (!filePath) {
      missingFile += 1;
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      missingFile += 1;
      continue;
    }

    const extractedText = await extractPdfText(buffer);
    await prisma.apartmentDocument.update({
      where: { id: doc.id },
      data: { extractedText },
    });

    if (extractedText) withText += 1;
    else withoutText += 1;

    await backgroundThrottlePause(50);
  }

  return {
    processed: pdfDocuments.length,
    withText,
    withoutText,
    missingFile,
  };
}
