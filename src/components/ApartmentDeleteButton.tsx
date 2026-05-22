"use client";

import { useTransition } from "react";
import { deleteApartmentAction } from "@/app/actions";
import { APARTMENT_TOOLBAR_BTN_DANGER } from "@/lib/apartment-toolbar-styles";

export function ApartmentDeleteButton({
  apartmentId,
  compact,
  toolbar,
}: {
  apartmentId: string;
  compact?: boolean;
  toolbar?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Bist Du sicher?")) return;
        startTransition(() => deleteApartmentAction(apartmentId));
      }}
      className={
        toolbar
          ? APARTMENT_TOOLBAR_BTN_DANGER
          : compact
            ? "text-sm text-pn-score-low hover:underline disabled:opacity-50 shrink-0 self-center"
            : "text-sm text-pn-score-low border border-pn-score-low/40 px-3 py-1.5 rounded-lg hover:bg-pn-score-low-bg disabled:opacity-50"
      }
    >
      {pending ? "Löscht…" : "Löschen"}
    </button>
  );
}
