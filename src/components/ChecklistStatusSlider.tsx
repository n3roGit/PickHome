"use client";

import {
  CHECKLIST_STATUS_LEGEND,
  checklistStatusFromIndex,
  checklistStatusToIndex,
  type ChecklistStatus,
} from "@/lib/checklist-display";

function symbolClass(status: ChecklistStatus, active: boolean): string {
  if (!active) return "text-pn-text-tertiary opacity-50";
  if (status === "ok") return "text-pn-score-high";
  if (status === "not_ok") return "text-pn-score-low";
  return "text-pn-text-secondary";
}

export function ChecklistStatusSlider({
  status,
  disabled,
  onChange,
}: {
  status: ChecklistStatus;
  disabled?: boolean;
  onChange: (status: ChecklistStatus) => void;
}) {
  const index = checklistStatusToIndex(status);
  const current = CHECKLIST_STATUS_LEGEND[index];

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center gap-1 text-base font-bold select-none" aria-hidden>
        {CHECKLIST_STATUS_LEGEND.map((s) => (
          <span
            key={s.key}
            className={`w-6 text-center ${symbolClass(s.key, s.key === status)}`}
          >
            {s.symbol}
          </span>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={2}
        step={1}
        value={index}
        disabled={disabled}
        aria-label={current?.ariaLabel ?? "Checklisten-Status"}
        title={current?.hint}
        className="checklist-status-range w-20"
        onChange={(e) => onChange(checklistStatusFromIndex(Number(e.target.value)))}
      />
    </div>
  );
}
