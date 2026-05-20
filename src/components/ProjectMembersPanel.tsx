"use client";

import {
  addProjectMemberAction,
  removeProjectMemberAction,
} from "@/app/actions";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";

type Member = {
  userId: string;
  role: string;
  user: { id: string; name: string; username: string };
};

const memberErrors: Record<string, string> = {
  not_found: "Benutzer wurde nicht gefunden (oder ist Administrator).",
  already_member: "Diese Person ist bereits im Projekt.",
  last_member: "Das letzte Projektmitglied kann nicht entfernt werden.",
};

export function ProjectMembersPanel({
  projectId,
  members,
  currentUserId,
  message,
  error,
}: {
  projectId: string;
  members: Member[];
  currentUserId: string;
  message?: string;
  error?: string;
}) {
  const sorted = [...members].sort((a, b) => a.user.name.localeCompare(b.user.name, "de"));

  return (
    <div className="space-y-6">
      {message && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">{message}</p>
      )}
      {error && memberErrors[error] && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          {memberErrors[error]}
        </p>
      )}

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Projektmitglieder ({sorted.length})</h2>
        <ul className="divide-y divide-pn-border">
          {sorted.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="font-medium">{m.user.name}</p>
                <p className="text-sm text-pn-text-secondary font-mono">@{m.user.username}</p>
                <p className="text-xs text-pn-text-tertiary mt-0.5">
                  {m.role === "owner" ? "Erstellt das Projekt" : "Partner"}
                  {m.userId === currentUserId ? " · Du" : ""}
                </p>
              </div>
              {sorted.length > 1 && (
                <ConfirmActionButton
                  confirmMessage={
                    m.userId === currentUserId
                      ? "Möchtest du dieses Projekt wirklich verlassen?"
                      : `„${m.user.name}" wirklich aus dem Projekt entfernen?`
                  }
                  action={() => removeProjectMemberAction(projectId, m.userId)}
                  className="text-sm text-pn-score-low hover:underline disabled:opacity-50"
                  pendingLabel="…"
                  title={
                    m.userId === currentUserId
                      ? "Dich aus dem Projekt entfernen"
                      : "Aus Projekt entfernen"
                  }
                >
                  {m.userId === currentUserId ? "Verlassen" : "Entfernen"}
                </ConfirmActionButton>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5">
        <h2 className="font-semibold mb-2">Person hinzufügen</h2>
        <p className="text-sm text-pn-text-secondary mb-4">
          Benutzername eingeben (muss bereits in PickHome registriert sein).
        </p>
        <form action={addProjectMemberAction.bind(null, projectId)} className="flex flex-wrap gap-2">
          <input
            name="username"
            placeholder="Benutzername, z. B. jasmin"
            className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
            required
          />
          <button
            type="submit"
            className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            Hinzufügen
          </button>
        </form>
      </section>
    </div>
  );
}
