"use client";

import {
  CHECKLIST_STATUS_LEGEND,
  type ChecklistStatus,
} from "@/lib/checklist-display";

function statusButtonClass(key: ChecklistStatus, active: boolean): string {
  const base =
    "inline-flex w-10 h-10 sm:w-11 sm:h-11 items-center justify-center rounded-lg text-base font-bold border shrink-0 touch-manipulation transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  if (!active) {
    return `${base} bg-pn-bg-surface border-pn-border text-pn-text-tertiary hover:border-pn-border-strong hover:text-pn-text-secondary`;
  }
  if (key === "ok") {
    return `${base} bg-pn-score-high-bg border-pn-accent text-pn-score-high`;
  }
  if (key === "not_ok") {
    return `${base} bg-pn-score-low-bg border-pn-score-low text-pn-score-low`;
  }
  return `${base} bg-pn-bg-subtle border-pn-border text-pn-text-secondary`;
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
  return (
    <div
      role="radiogroup"
      aria-label="Checklisten-Status"
      className="flex items-center gap-1.5 w-full min-w-0"
    >
      {CHECKLIST_STATUS_LEGEND.map((s) => {
        const active = s.key === status;
        return (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={s.ariaLabel}
            title={s.hint}
            disabled={disabled}
            className={statusButtonClass(s.key, active)}
            onClick={() => {
              if (!disabled && s.key !== status) onChange(s.key);
            }}
          >
            {s.symbol}
          </button>
        );
      })}
    </div>
  );
}
