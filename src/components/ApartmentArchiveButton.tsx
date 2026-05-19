"use client";

import { useTransition } from "react";
import { archiveApartmentAction, unarchiveApartmentAction } from "@/app/actions";

export function ApartmentArchiveButton({
  apartmentId,
  archived,
}: {
  apartmentId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!archived && !window.confirm("Bist Du sicher?")) return;
        startTransition(() =>
          archived
            ? unarchiveApartmentAction(apartmentId)
            : archiveApartmentAction(apartmentId)
        );
      }}
      className="text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
    >
      {archived ? "Wiederherstellen" : "Archivieren"}
    </button>
  );
}
