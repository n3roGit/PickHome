export const ARCHIVE_REASONS = [
  { code: "too_expensive", labelDe: "Zu teuer" },
  { code: "location", labelDe: "Lage" },
  { code: "condition", labelDe: "Zustand" },
  { code: "layout", labelDe: "Grundriss / Größe" },
  { code: "commute", labelDe: "Anfahrt" },
  { code: "other", labelDe: "Sonstiges" },
] as const;

export type ArchiveReasonCode = (typeof ARCHIVE_REASONS)[number]["code"];

const REASON_CODES = new Set<string>(ARCHIVE_REASONS.map((r) => r.code));

export function archiveReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return ARCHIVE_REASONS.find((r) => r.code === code)?.labelDe ?? code;
}

export function parseArchiveReason(raw: string): ArchiveReasonCode | null {
  const code = raw.trim();
  if (!code || !REASON_CODES.has(code)) return null;
  return code as ArchiveReasonCode;
}

export function parseArchiveNote(raw: string): string | null {
  const note = raw.trim();
  return note.length > 0 ? note.slice(0, 500) : null;
}
