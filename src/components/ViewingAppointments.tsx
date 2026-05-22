"use client";

import { useTransition } from "react";
import { addViewingAction, deleteViewingAction, updateViewingAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { formatDateTimeDe, normalizeScheduledAtFormData, toDatetimeLocalValue } from "@/lib/dates";
import { useAppTimeZone } from "@/lib/use-app-timezone";

type Viewing = {
  id: string;
  scheduledAt: string;
  note: string | null;
};

export function ViewingAppointments({
  apartmentId,
  viewings,
}: {
  apartmentId: string;
  viewings: Viewing[];
}) {
  const appTimeZone = useAppTimeZone();
  const [pending, startTransition] = useTransition();
  const now = new Date();

  const parsed = viewings.map((v) => ({
    ...v,
    date: new Date(v.scheduledAt),
  }));
  const upcoming = parsed.filter((v) => v.date > now).sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = parsed.filter((v) => v.date <= now).sort((a, b) => b.date.getTime() - a.date.getTime());

  const defaultDatetime = toDatetimeLocalValue(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0)
  );

  function onDelete(id: string, date: Date) {
    if (!window.confirm(`Besichtigung am ${formatDateTimeDe(date, appTimeZone)} wirklich löschen?`)) {
      return;
    }
    startTransition(() => deleteViewingAction(id));
  }

  function onUpdate(id: string, formData: FormData) {
    normalizeScheduledAtFormData(formData);
    startTransition(() => updateViewingAction(id, formData));
  }

  return (
    <CollapsibleSection
      title="Besichtigungstermine"
      defaultOpen
      headerAside={viewings.length > 0 ? `${viewings.length} Termine` : undefined}
    >
      <form
        action={(formData) => {
          normalizeScheduledAtFormData(formData);
          startTransition(() => addViewingAction(apartmentId, formData));
        }}
        className="flex flex-wrap gap-2 mb-6 p-4 bg-pn-bg-subtle border border-pn-border rounded-xl"
      >
        <label className="flex flex-col text-sm w-full min-w-0 sm:min-w-[200px] sm:flex-1">
          <span className="text-pn-text-secondary mb-1">Datum & Uhrzeit</span>
          <input
            type="datetime-local"
            name="scheduledAt"
            required
            defaultValue={defaultDatetime}
            disabled={pending}
            className="border border-pn-border rounded-lg px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm w-full min-w-0 sm:min-w-[200px] sm:flex-[2]">
          <span className="text-pn-text-secondary mb-1">Notiz (optional)</span>
          <input
            type="text"
            name="note"
            placeholder="z. B. mit Makler, Schlüssel abholen"
            disabled={pending}
            className="border border-pn-border rounded-lg px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-pn-accent text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50 w-full sm:w-auto"
        >
          Termin hinzufügen
        </button>
      </form>

      {upcoming.length > 0 && (
        <ViewingList
          title="Anstehend"
          items={upcoming}
          pending={pending}
          timeZone={appTimeZone}
          onDelete={onDelete}
          onUpdate={onUpdate}
          variant="upcoming"
        />
      )}
      {past.length > 0 && (
        <ViewingList
          title="Vergangen"
          items={past}
          pending={pending}
          timeZone={appTimeZone}
          onDelete={onDelete}
          onUpdate={onUpdate}
          variant="past"
        />
      )}
      {viewings.length === 0 && (
        <p className="text-sm text-pn-text-tertiary">Noch keine Besichtigungstermine.</p>
      )}
    </CollapsibleSection>
  );
}

function ViewingList({
  title,
  items,
  pending,
  timeZone,
  onDelete,
  onUpdate,
  variant,
}: {
  title: string;
  items: { id: string; date: Date; note: string | null }[];
  pending: boolean;
  timeZone: string;
  onDelete: (id: string, date: Date) => void;
  onUpdate: (id: string, formData: FormData) => void;
  variant: "upcoming" | "past";
}) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-pn-text-secondary mb-2">{title}</h3>
      <ul className="space-y-2">
        {items.map((v) => (
          <li
            key={v.id}
            className={`border rounded-lg px-4 py-3 ${
              variant === "upcoming"
                ? "border-pn-accent/30 bg-pn-bg-surface"
                : "border-pn-border bg-pn-bg-subtle"
            }`}
          >
            <div className="mb-3">
              <p className="font-medium">{formatDateTimeDe(v.date, timeZone)}</p>
              {v.note && <p className="text-sm text-pn-text-secondary">{v.note}</p>}
            </div>
            <form
              action={(formData) => onUpdate(v.id, formData)}
              className="flex flex-wrap gap-2 items-end"
              data-unsaved-track
              data-unsaved-label={`Besichtigung ${formatDateTimeDe(v.date, timeZone)}`}
            >
              <label className="flex flex-col text-sm w-full min-w-0 sm:min-w-[190px] sm:flex-1">
                <span className="text-pn-text-secondary mb-1">Datum & Uhrzeit</span>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  required
                  defaultValue={toDatetimeLocalValue(v.date)}
                  disabled={pending}
                  className="border border-pn-border rounded-lg px-3 py-2"
                />
              </label>
              <label className="flex flex-col text-sm w-full min-w-0 sm:min-w-[190px] sm:flex-[2]">
                <span className="text-pn-text-secondary mb-1">Notiz</span>
                <input
                  type="text"
                  name="note"
                  defaultValue={v.note ?? ""}
                  disabled={pending}
                  className="border border-pn-border rounded-lg px-3 py-2"
                />
              </label>
              <button
                type="submit"
                disabled={pending}
                className="bg-pn-accent text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50 w-full sm:w-auto"
              >
                Speichern
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => onDelete(v.id, v.date)}
                className="border border-pn-border px-4 py-2 rounded-lg text-sm text-pn-text-secondary hover:text-pn-score-low disabled:opacity-50 w-full sm:w-auto"
              >
                Löschen
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
