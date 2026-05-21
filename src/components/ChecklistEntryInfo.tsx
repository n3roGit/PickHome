import Link from "next/link";
import {
  checklistStatusLabel,
  hasChecklistInfo,
  type ChecklistStatus,
} from "@/lib/checklist-display";

export function ChecklistEntryInfo({
  status,
  note,
  editHref,
  canEdit,
}: {
  status: string;
  note: string | null;
  editHref?: string;
  canEdit?: boolean;
}) {
  if (!hasChecklistInfo({ status, note })) return null;

  const label = checklistStatusLabel(status);
  const parsed = status as ChecklistStatus;

  return (
    <div className="mt-2 rounded-lg bg-pn-bg-subtle border border-pn-border px-3 py-2 text-sm">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-pn-text-tertiary mb-1">
        Checkliste
      </p>
      <div className="flex flex-wrap items-start gap-2">
        {label && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              parsed === "ok"
                ? "bg-pn-score-high-bg text-pn-score-high"
                : parsed === "open"
                  ? "bg-pn-score-mid-bg text-pn-score-mid"
                  : "bg-pn-bg-surface text-pn-text-tertiary"
            }`}
          >
            {label}
          </span>
        )}
        {note?.trim() && (
          <span className="text-pn-text-secondary flex-1 min-w-0">{note.trim()}</span>
        )}
      </div>
      {canEdit && editHref && (
        <Link href={editHref} className="text-xs text-pn-accent hover:underline mt-1 inline-block">
          In Checkliste bearbeiten
        </Link>
      )}
    </div>
  );
}
