"use client";

import { useTransition } from "react";
import {
  addChecklistCustomItemAction,
  removeChecklistCustomItemAction,
  toggleChecklistCriterionAction,
  updateChecklistItemAssigneeAction,
  updateCriterionGroupBrokerQuestionsAction,
} from "@/app/checklist-actions";
import { checklistItemDisplayName } from "@/lib/checklist-display";

type Criterion = {
  id: string;
  name: string;
  weight: number;
  isDealbreaker: boolean;
};

type Group = {
  id: string;
  name: string;
  brokerQuestions: string | null;
  criteria: Criterion[];
};

type ChecklistItemRow = {
  id: string;
  criterionId: string | null;
  name: string | null;
  assigneeUserId: string | null;
  criterionGroupId: string;
  criterion: { id: string; name: string; weight: number; isDealbreaker: boolean } | null;
};

type Member = { userId: string; name: string };

export function ChecklistConfigEditor({
  projectId,
  groups,
  members,
  checklistItems,
}: {
  projectId: string;
  groups: Group[];
  members: Member[];
  checklistItems: ChecklistItemRow[];
}) {
  const [pending, startTransition] = useTransition();

  const itemByCriterionId = new Map(
    checklistItems
      .filter((i) => i.criterionId)
      .map((i) => [i.criterionId!, i])
  );
  const customItems = checklistItems.filter((i) => !i.criterionId);
  const enabledCount = checklistItems.filter((i) => i.criterionId).length;

  function assigneeRadios(itemId: string, current: string | null, name: string) {
    return (
      <div className="assign-row flex flex-wrap items-center gap-2 mt-2">
        <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-pn-text-tertiary">
          Zuordnung
        </span>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="radio"
              name={name}
              checked={current == null}
              disabled={pending}
              onChange={() =>
                startTransition(() => updateChecklistItemAssigneeAction(itemId, null))
              }
            />
            Beide
          </label>
          {members.map((m) => (
            <label key={m.userId} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name={name}
                checked={current === m.userId}
                disabled={pending}
                onChange={() =>
                  startTransition(() => updateChecklistItemAssigneeAction(itemId, m.userId))
                }
              />
              {m.name}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-pn-text-secondary">
        Aktiviere Kriterien für die Besichtigungs-Checkliste und ordne sie einem Teammitglied zu.
        Namen und Gewichtung bearbeitest du im Tab „Kriterien“.
      </p>

      <p className="text-sm bg-pn-brand-muted border border-green-200 rounded-xl px-4 py-3 text-pn-brand">
        <strong>{checklistItems.length}</strong> Punkte in der Checkliste ·{" "}
        <strong>{enabledCount}</strong> aus Kriterien · <strong>{customItems.length}</strong> Zusatzpunkte
      </p>

      {groups.map((g) => (
        <section key={g.id} className="border border-pn-border rounded-xl overflow-hidden bg-pn-bg-surface">
          <div className="px-4 py-3 border-b border-pn-border flex justify-between items-baseline gap-2">
            <h2 className="font-semibold m-0">{g.name}</h2>
            <span className="text-xs text-pn-text-tertiary">Bewertungsgruppe</span>
          </div>

          <ul>
            {g.criteria.map((c) => {
              const item = itemByCriterionId.get(c.id);
              const enabled = !!item;
              return (
                <li key={c.id} className="px-4 py-3 border-t border-pn-border">
                  <div className="flex gap-3 items-start">
                    <input
                      type="checkbox"
                      className="mt-1 accent-pn-accent"
                      checked={enabled}
                      disabled={pending}
                      onChange={(e) =>
                        startTransition(() =>
                          toggleChecklistCriterionAction(projectId, c.id, e.target.checked)
                        )
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm m-0 flex flex-wrap items-center gap-2">
                        {c.name}
                        <span className="text-[0.625rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-pn-bg-subtle text-pn-text-tertiary">
                          Kriterium
                        </span>
                        {c.isDealbreaker && (
                          <span className="text-xs text-pn-score-low font-semibold">Dealbreaker</span>
                        )}
                      </p>
                      <p className="text-xs text-pn-text-tertiary mt-0.5">Gewicht {c.weight}</p>
                      {enabled && item && assigneeRadios(item.id, item.assigneeUserId, `c-${c.id}`)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="px-4 py-3 border-t border-dashed border-pn-border bg-pn-bg-subtle">
            <label className="block text-[0.6875rem] font-bold uppercase tracking-wide text-pn-text-tertiary mb-1">
              Makler-Fragen (optional)
            </label>
            <BrokerQuestionsField
              groupId={g.id}
              defaultValue={g.brokerQuestions ?? ""}
              disabled={pending}
            />
          </div>
        </section>
      ))}

      <section className="border border-pn-border rounded-xl overflow-hidden bg-pn-bg-surface">
        <div className="px-4 py-3 border-b border-pn-border flex justify-between items-baseline">
          <h2 className="font-semibold m-0">Zusätzliche Punkte</h2>
          <span className="text-xs text-pn-text-tertiary">Nur Checkliste</span>
        </div>

        {customItems.length === 0 && (
          <p className="px-4 py-4 text-sm text-pn-text-tertiary m-0">Noch keine Zusatzpunkte.</p>
        )}

        {customItems.map((item) => (
          <div key={item.id} className="px-4 py-3 border-t border-pn-border">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-medium text-sm m-0">
                {checklistItemDisplayName(item)}
                <span className="ml-2 text-[0.625rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                  Zusatz
                </span>
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => removeChecklistCustomItemAction(item.id))}
                className="text-xs font-semibold text-pn-score-low hover:underline disabled:opacity-50"
              >
                Entfernen
              </button>
            </div>
            {assigneeRadios(item.id, item.assigneeUserId, `z-${item.id}`)}
          </div>
        ))}

        <AddCustomItemForm projectId={projectId} groups={groups} disabled={pending} />
      </section>
    </div>
  );
}

function BrokerQuestionsField({
  groupId,
  defaultValue,
  disabled,
}: {
  groupId: string;
  defaultValue: string;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <textarea
      key={`${groupId}-${defaultValue}`}
      defaultValue={defaultValue}
      rows={3}
      disabled={disabled || pending}
      placeholder="Fragen an Makler oder Verkäufer …"
      className="w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
      onBlur={(e) => {
        const value = e.target.value;
        if (value === defaultValue) return;
        startTransition(() => updateCriterionGroupBrokerQuestionsAction(groupId, value));
      }}
    />
  );
}

function AddCustomItemForm({
  projectId,
  groups,
  disabled,
}: {
  projectId: string;
  groups: Group[];
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2 p-4 bg-pn-bg-subtle border-t border-pn-border"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const name = String(fd.get("name") ?? "").trim();
        const groupId = String(fd.get("groupId") ?? "");
        if (!name || !groupId) return;
        startTransition(async () => {
          await addChecklistCustomItemAction(projectId, groupId, name);
          form.reset();
        });
      }}
    >
      <input
        name="name"
        placeholder="Name des Zusatzpunkts"
        className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[10rem]"
        disabled={disabled || pending}
      />
      <select
        name="groupId"
        className="border border-pn-border rounded-lg px-3 py-2 text-sm"
        disabled={disabled || pending}
        defaultValue={groups[0]?.id ?? ""}
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            Gruppe: {g.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={disabled || pending}
        className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
      >
        Zusatzpunkt hinzufügen
      </button>
    </form>
  );
}
