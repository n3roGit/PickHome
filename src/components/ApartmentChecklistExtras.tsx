import Link from "next/link";
import {
  checklistItemDisplayName,
  checklistStatusLabel,
  hasChecklistInfo,
} from "@/lib/checklist-display";

type ExtraEntry = {
  itemId: string;
  name: string;
  groupName: string;
  status: string;
  note: string | null;
};

export function ApartmentChecklistExtras({
  entries,
  checklistHref,
}: {
  entries: ExtraEntry[];
  checklistHref: string;
}) {
  const filled = entries.filter((e) => hasChecklistInfo(e));
  if (filled.length === 0) return null;

  const byGroup = new Map<string, ExtraEntry[]>();
  for (const e of filled) {
    const list = byGroup.get(e.groupName) ?? [];
    list.push(e);
    byGroup.set(e.groupName, list);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-pn-text-secondary">
        Zusatzpunkte aus der Besichtigungs-Checkliste (nur ausgefüllte).
      </p>
      {[...byGroup.entries()].map(([groupName, items]) => (
        <section key={groupName}>
          <h3 className="text-xs font-semibold text-pn-text-tertiary uppercase tracking-wide mb-2">
            {groupName}
          </h3>
          <ul className="space-y-2">
            {items.map((e) => (
              <li
                key={e.itemId}
                className="bg-pn-bg-surface border border-pn-border rounded-lg px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-[0.625rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                    Zusatz
                  </span>
                  {checklistStatusLabel(e.status) && (
                    <span className="text-xs text-pn-text-tertiary">
                      {checklistStatusLabel(e.status)}
                    </span>
                  )}
                </div>
                {e.note?.trim() && (
                  <p className="text-pn-text-secondary mt-1 mb-0">{e.note.trim()}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link href={checklistHref} className="text-sm text-pn-accent hover:underline">
        Checkliste öffnen
      </Link>
    </div>
  );
}
