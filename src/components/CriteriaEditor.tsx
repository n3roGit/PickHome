"use client";

import { useTransition } from "react";
import {
  addCriterionAction,
  createCriterionGroupAction,
  deleteCriterionGroupAction,
  reorderCriterionGroupsAction,
  updateCriterionAction,
  updateCriterionGroupAction,
} from "@/app/actions";

type Group = {
  id: string;
  name: string;
  criteria: { id: string; name: string; weight: number; isDealbreaker: boolean }[];
};

export function CriteriaEditor({
  projectId,
  groups,
  dealbreakerThreshold,
}: {
  projectId: string;
  groups: Group[];
  dealbreakerThreshold: number;
}) {
  const [pending, startTransition] = useTransition();

  function moveGroup(groupId: string, direction: "up" | "down") {
    const ids = groups.map((g) => g.id);
    const index = ids.indexOf(groupId);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(() => reorderCriterionGroupsAction(projectId, next));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-pn-text-secondary">
        Gewichtung (1–5) und Dealbreaker festlegen. Bei Dealbreakern führt ein Wert ≤{dealbreakerThreshold} zum Ausschluss (Score 0).
      </p>

      <form
        className="flex flex-wrap gap-2 items-center bg-pn-bg-surface border border-pn-border rounded-xl p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
          if (!name) return;
          startTransition(() => {
            createCriterionGroupAction(projectId, name);
            e.currentTarget.reset();
          });
        }}
      >
        <input
          name="name"
          placeholder="Name der neuen Kriteriengruppe"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full min-w-0 flex-1"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-pn-accent text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          Gruppe anlegen
        </button>
      </form>

      {groups.map((g, index) => (
        <section key={g.id} className="border border-pn-border rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={pending || index === 0}
                onClick={() => moveGroup(g.id, "up")}
                className="text-xs px-2 py-0.5 border border-pn-border rounded hover:bg-pn-bg-subtle disabled:opacity-30"
                title="Nach oben"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={pending || index === groups.length - 1}
                onClick={() => moveGroup(g.id, "down")}
                className="text-xs px-2 py-0.5 border border-pn-border rounded hover:bg-pn-bg-subtle disabled:opacity-30"
                title="Nach unten"
              >
                ↓
              </button>
            </div>

            <form
              className="flex-1 flex flex-wrap items-center gap-2 min-w-0 w-full sm:min-w-[200px]"
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                if (!name || name === g.name) return;
                startTransition(() => updateCriterionGroupAction(g.id, name));
              }}
            >
              <input
                name="name"
                defaultValue={g.name}
                key={`${g.id}-${g.name}`}
                className="font-semibold border border-pn-border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-0 w-full sm:min-w-[160px]"
                disabled={pending}
              />
              <button
                type="submit"
                disabled={pending}
                className="text-sm text-pn-accent font-medium hover:underline"
              >
                Umbenennen
              </button>
              <span className="text-pn-text-tertiary text-sm">({g.criteria.length} Kriterien)</span>
            </form>

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `Gruppe „${g.name}" wirklich löschen? Alle Kriterien und Bewertungen darin werden entfernt.`
                  )
                ) {
                  return;
                }
                startTransition(() => deleteCriterionGroupAction(g.id));
              }}
              className="text-sm text-pn-score-low hover:underline disabled:opacity-50"
            >
              Gruppe löschen
            </button>
          </div>

          <ul className="space-y-3">
            {g.criteria.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                <span className="w-full sm:flex-1 sm:min-w-[140px] font-medium">{c.name}</span>
                <span className="text-pn-text-tertiary">Gewicht:</span>
                {[1, 2, 3, 4, 5].map((w) => (
                  <button
                    key={w}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => updateCriterionAction(c.id, { weight: w }))
                    }
                    className={`w-8 h-8 rounded border text-xs font-bold ${
                      c.weight === w
                        ? "bg-pn-accent text-white border-pn-accent"
                        : "border-pn-border hover:bg-pn-bg-subtle"
                    }`}
                  >
                    {w}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() =>
                      updateCriterionAction(c.id, { isDealbreaker: !c.isDealbreaker })
                    )
                  }
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    c.isDealbreaker
                      ? "bg-pn-score-low-bg text-pn-score-low"
                      : "border border-pn-border text-pn-text-tertiary"
                  }`}
                >
                  {c.isDealbreaker ? "Dealbreaker aktiv" : "Als Dealbreaker"}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("name") ?? "").trim();
              if (!name) return;
              startTransition(() => addCriterionAction(projectId, g.id, name));
              e.currentTarget.reset();
            }}
          >
            <input
              name="name"
              placeholder="Neues Kriterium"
              className="border border-pn-border rounded px-2 py-1 text-sm flex-1"
              disabled={pending}
            />
            <button type="submit" disabled={pending} className="text-sm text-pn-accent font-medium">
              Hinzufügen
            </button>
          </form>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="text-sm text-pn-text-tertiary text-center py-6">
          Noch keine Kriteriengruppen. Lege oben eine neue Gruppe an.
        </p>
      )}
    </div>
  );
}
