import { readFile } from "fs/promises";
import { assertApartmentAccess } from "@/lib/project-data";
import type { ProjectAccessUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type {
  ApartmentLlmContextInput,
  ApartmentLlmScoringInput,
} from "@/lib/apartment-llm-context";
import { publicPhotoPath } from "@/lib/pickhome-data";
import { parseChecklistStatus } from "@/lib/checklist-display";
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
      project: {
        select: {
          name: true,
          dealbreakerThreshold: true,
          members: {
            include: { user: { select: { id: true, name: true } } },
          },
          groups: {
            orderBy: { sortOrder: "asc" },
            include: {
              criteria: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
      ratings: {
        select: {
          criterionId: true,
          userId: true,
          score: true,
          note: true,
        },
      },
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

  const scoring = buildApartmentLlmScoringInput(row.project, row.ratings, user.id);

  return {
    projectName: row.project.name,
    apartment: {
      projectName: row.project.name,
      title: row.title,
      scoring,
      address: row.address,
      listingUrl: row.listingUrl,
      price: row.price,
      sizeSqm: row.sizeSqm,
      plotSizeSqm: row.plotSizeSqm,
      floor: row.floor,
      yearBuilt: row.yearBuilt,
      energyClass: row.energyClass,
      brokerInvolved: row.brokerInvolved,
      hoaFeeMonthly: row.hoaFeeMonthly,
      heatingCostMonthly: row.heatingCostMonthly,
      propertyTaxAnnual: row.propertyTaxAnnual,
      renovationCost: row.renovationCost,
      description: row.description,
      notes: row.notes,
      documents,
    },
    pdfDocuments: row.documents,
  };
}

function buildApartmentLlmScoringInput(
  project: {
    dealbreakerThreshold: number;
    members: { userId: string; user: { id: string; name: string } }[];
    groups: {
      name: string;
      criteria: {
        id: string;
        name: string;
        weight: number;
        isDealbreaker: boolean;
      }[];
    }[];
  },
  ratings: ApartmentLlmScoringInput["ratings"],
  focusUserId: string
): ApartmentLlmScoringInput | null {
  const groups = project.groups
    .map((g) => ({
      name: g.name,
      criteria: g.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        weight: c.weight,
        isDealbreaker: c.isDealbreaker,
      })),
    }))
    .filter((g) => g.criteria.length > 0);
  if (groups.length === 0) return null;

  return {
    dealbreakerThreshold: project.dealbreakerThreshold,
    groups,
    ratings,
    members: project.members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
    })),
    focusUserId,
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

const CHECKLIST_STATUS_LABEL: Record<ReturnType<typeof parseChecklistStatus>, string> = {
  unset: "offen",
  not_ok: "nicht OK",
  ok: "OK",
};

/** Lines for listing extract from checklist entries with status or note. */
export async function buildApartmentChecklistExtractLines(
  apartmentId: string
): Promise<string[]> {
  const entries = await prisma.checklistEntry.findMany({
    where: { apartmentId },
    include: {
      item: {
        include: {
          criterionGroup: { select: { name: true } },
          criterion: { select: { name: true } },
        },
      },
    },
    orderBy: { item: { sortOrder: "asc" } },
  });

  const lines: string[] = [];
  for (const entry of entries) {
    const status = parseChecklistStatus(entry.status);
    const note = entry.note?.trim();
    if (status === "unset" && !note) continue;

    const label =
      entry.item.criterion?.name?.trim() || entry.item.name?.trim() || "Checklistenpunkt";
    let line = `- [${entry.item.criterionGroup.name}] ${label}: ${CHECKLIST_STATUS_LABEL[status]}`;
    if (note) line += ` — Notiz: ${note}`;
    lines.push(line);
  }
  return lines;
}
