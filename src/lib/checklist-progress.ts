import { hasChecklistInfo } from "./checklist-display";

export function countFilledChecklistEntries(
  entries: { status: string; note: string | null }[]
): number {
  return entries.filter((e) => hasChecklistInfo(e)).length;
}

export function checklistProgress(
  totalItems: number,
  entries: { status: string; note: string | null }[]
): { filled: number; total: number } {
  return {
    filled: countFilledChecklistEntries(entries),
    total: totalItems,
  };
}
