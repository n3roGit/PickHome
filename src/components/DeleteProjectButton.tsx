"use client";

import { useTransition } from "react";
import { deleteProjectAction } from "@/app/actions";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    const ok = window.confirm(
      `Projekt „${projectName}" wirklich löschen? Alle Immobilien, Bewertungen, Bilder und Termine werden unwiderruflich entfernt.`
    );
    if (!ok) return;
    startTransition(() => deleteProjectAction(projectId));
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onDelete}
      className="text-sm text-pn-score-low border border-pn-score-low/40 px-3 py-1.5 rounded-lg hover:bg-pn-score-low-bg disabled:opacity-50"
    >
      {pending ? "Löscht…" : "Projekt löschen"}
    </button>
  );
}
