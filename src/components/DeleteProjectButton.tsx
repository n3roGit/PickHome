"use client";

import { useState, useTransition } from "react";
import { deleteProjectAction } from "@/app/actions";
import { useFocusWhen } from "@/hooks/use-focus-when";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const confirmInputRef = useFocusWhen<HTMLInputElement>(open);

  const nameMatches = confirmName.trim() === projectName;

  function close() {
    setOpen(false);
    setConfirmName("");
  }

  function onDelete() {
    if (!nameMatches) return;
    startTransition(() => deleteProjectAction(projectId));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-pn-score-low border border-pn-score-low/40 px-3 py-1.5 rounded-lg hover:bg-pn-score-low-bg"
      >
        Projekt löschen
      </button>
    );
  }

  return (
    <div className="border border-pn-score-low/40 rounded-lg p-4 space-y-3 max-w-md">
      <p className="text-sm text-pn-text-secondary">
        Alle Immobilien, Bewertungen, Bilder und Termine werden unwiderruflich entfernt. Gib den
        Projektnamen <span className="font-medium text-pn-text-primary">„{projectName}"</span> ein,
        um zu bestätigen.
      </p>
      <label className="block">
        <span className="text-sm font-medium text-pn-text-secondary">Projektname</span>
        <input
          ref={confirmInputRef}
          name="confirmName"
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          autoComplete="off"
          className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!nameMatches || pending}
          onClick={onDelete}
          className="text-sm text-white bg-pn-score-low font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {pending ? "Löscht…" : "Endgültig löschen"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={close}
          className="text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
