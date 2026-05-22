"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveChecklistEntryAction } from "@/app/checklist-actions";
import { ChecklistStatusSlider } from "@/components/ChecklistStatusSlider";
import {
  CHECKLIST_STATUS_LEGEND,
  parseChecklistStatus,
  type ApartmentChecklistGroupBlock,
  type ChecklistStatus,
} from "@/lib/checklist-display";
import { countFilledChecklistEntries } from "@/lib/checklist-progress";

export type ApartmentChecklistPartnerView = {
  userId: string;
  name: string;
  groups: ApartmentChecklistGroupBlock[];
  brokerDigest: string;
};

function legendSymbolClass(key: ChecklistStatus): string {
  if (key === "ok") return "bg-pn-score-high-bg border-pn-accent text-pn-score-high";
  if (key === "not_ok") return "bg-pn-score-low-bg border-pn-score-low text-pn-score-low";
  return "bg-pn-bg-surface border-pn-border text-pn-text-tertiary";
}

export function ApartmentChecklist({
  apartmentId,
  groups,
  brokerDigest,
  partners,
}: {
  apartmentId: string;
  groups: ApartmentChecklistGroupBlock[];
  brokerDigest: string;
  partners: ApartmentChecklistPartnerView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"mine" | string>("mine");

  const initialEntries = useMemo(() => {
    const map: Record<string, { status: ChecklistStatus; note: string }> = {};
    for (const g of groups) {
      for (const item of g.items) {
        map[item.id] = {
          status: parseChecklistStatus(item.entry?.status ?? "unset"),
          note: item.entry?.note ?? "",
        };
      }
    }
    return map;
  }, [groups]);

  const [entries, setEntries] = useState(initialEntries);

  const active = useMemo(() => {
    if (view === "mine") {
      return {
        groups,
        brokerDigest,
        readonly: false,
        scopeLabel: "Nur dir zugewiesen",
      };
    }
    const partner = partners.find((p) => p.userId === view);
    if (!partner) {
      return {
        groups,
        brokerDigest,
        readonly: false,
        scopeLabel: "Nur dir zugewiesen",
      };
    }
    return {
      groups: partner.groups,
      brokerDigest: partner.brokerDigest,
      readonly: true,
      scopeLabel: `Nur Ansicht · ${partner.name}`,
    };
  }, [view, groups, brokerDigest, partners]);

  const allItems = active.groups.flatMap((g) => g.items);
  const filled = countFilledChecklistEntries(
    allItems.map((i) => {
      if (active.readonly) {
        return {
          status: i.entry?.status ?? "unset",
          note: i.entry?.note ?? null,
        };
      }
      return {
        status: entries[i.id]?.status ?? "unset",
        note: entries[i.id]?.note ?? null,
      };
    })
  );

  function persist(itemId: string, status: ChecklistStatus, note: string) {
    startTransition(async () => {
      await saveChecklistEntryAction(
        apartmentId,
        itemId,
        status,
        note.trim() || null
      );
      router.refresh();
    });
  }

  function setStatus(itemId: string, status: ChecklistStatus) {
    setEntries((prev) => {
      const note = prev[itemId]?.note ?? "";
      queueMicrotask(() => persist(itemId, status, note));
      return { ...prev, [itemId]: { ...prev[itemId], status, note } };
    });
  }

  function setNote(itemId: string, note: string) {
    setEntries((prev) => ({ ...prev, [itemId]: { ...prev[itemId], note } }));
  }

  function itemState(item: ApartmentChecklistGroupBlock["items"][number]) {
    if (active.readonly) {
      return {
        status: parseChecklistStatus(item.entry?.status ?? "unset"),
        note: item.entry?.note ?? "",
      };
    }
    return entries[item.id] ?? { status: "unset" as ChecklistStatus, note: "" };
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-pn-text-secondary flex justify-between gap-2">
        <span>
          <strong>{filled}</strong> von <strong>{allItems.length}</strong> mit Notiz oder Status
        </span>
        <span className="text-pn-text-tertiary">{active.scopeLabel}</span>
      </p>

      {active.brokerDigest.trim() && (
        <details className="bg-pn-bg-surface border border-pn-border rounded-xl open:shadow-sm">
          <summary className="px-4 py-3 text-sm font-semibold cursor-pointer list-none">
            Makler-Fragen (Spickzettel)
          </summary>
          <pre className="px-4 pb-3 text-xs text-pn-text-secondary whitespace-pre-wrap font-sans m-0">
            {active.brokerDigest.trim()}
          </pre>
        </details>
      )}

      {active.groups.map((g) =>
        g.items.length === 0 ? null : (
          <section key={g.id}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-pn-text-tertiary border-b-2 border-pn-border pb-1 mb-2 sticky top-0 bg-pn-bg-base z-10">
              {g.name}
            </h2>
            <ul className="bg-pn-bg-surface border border-pn-border rounded-xl overflow-hidden divide-y divide-pn-border">
              {g.items.map((item) => {
                const state = itemState(item);
                return (
                  <li key={item.id} className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-sm m-0 flex flex-wrap items-center gap-2">
                        {item.displayName}
                        <span
                          className={`text-[0.625rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            item.isCustom
                              ? "bg-violet-100 text-violet-800"
                              : "bg-pn-bg-subtle text-pn-text-tertiary"
                          }`}
                        >
                          {item.isCustom ? "Zusatz" : "Kriterium"}
                        </span>
                      </p>
                      <ChecklistStatusSlider
                        status={state.status}
                        disabled={pending || active.readonly}
                        onChange={(next) => setStatus(item.id, next)}
                      />
                    </div>
                    <input
                      type="text"
                      value={state.note}
                      readOnly={active.readonly}
                      disabled={pending || active.readonly}
                      placeholder="Fakt notieren…"
                      className="w-full border border-pn-border rounded-md px-2.5 py-2 text-sm bg-pn-bg-base focus:outline-none focus:ring-2 focus:ring-pn-accent disabled:bg-pn-bg-subtle disabled:text-pn-text-secondary"
                      onChange={(e) => setNote(item.id, e.target.value)}
                      onBlur={() => {
                        if (!active.readonly) {
                          persist(item.id, state.status, state.note);
                        }
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )
      )}

      {allItems.length === 0 && (
        <p className="text-center text-pn-text-tertiary py-8 text-sm">
          {active.readonly
            ? "Keine Checklisten-Punkte für diese Person konfiguriert."
            : "Keine Checklisten-Punkte für dich konfiguriert. Bitte im Projekt-Tab „Checkliste“ einrichten."}
        </p>
      )}

      <div className="bg-pn-bg-subtle border border-pn-border rounded-lg px-3 py-2.5 text-xs">
        <p className="font-semibold text-pn-text-primary m-0 mb-2">Legende</p>
        <ul className="m-0 p-0 space-y-1.5">
          {CHECKLIST_STATUS_LEGEND.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-2 text-pn-text-secondary">
              <span
                className={`inline-flex w-7 h-7 items-center justify-center rounded text-base font-bold border shrink-0 ${legendSymbolClass(s.key)}`}
                aria-hidden
              >
                {s.symbol}
              </span>
              <span>{s.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      {partners.length > 0 && (
        <div className="border-t border-pn-border pt-4 space-y-2">
          <p className="text-xs font-semibold text-pn-text-secondary m-0">Partner-Ansicht</p>
          <p className="text-xs text-pn-text-tertiary m-0">Nur lesen — Einträge des anderen Teammitglieds.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("mine")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                view === "mine"
                  ? "bg-pn-brand-muted border-pn-accent text-pn-brand"
                  : "bg-pn-bg-surface border-pn-border text-pn-text-secondary hover:border-pn-border-strong"
              }`}
            >
              Deine Punkte
            </button>
            {partners.map((p) => (
              <button
                key={p.userId}
                type="button"
                onClick={() => setView(p.userId)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  view === p.userId
                    ? "bg-pn-brand-muted border-pn-accent text-pn-brand"
                    : "bg-pn-bg-surface border-pn-border text-pn-text-secondary hover:border-pn-border-strong"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
