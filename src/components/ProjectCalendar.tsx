"use client";

import { useTransition } from "react";
import Link from "next/link";
import { deleteViewingAction, updateViewingAction } from "@/app/actions";
import {
  formatDateTimeDe,
  normalizeScheduledAtFormData,
  toDatetimeLocalValue,
} from "@/lib/dates";
import { useAppTimeZone } from "@/lib/use-app-timezone";

export type CalendarEvent = {
  id: string;
  apartmentId: string;
  apartmentTitle: string;
  scheduledAt: string;
  note: string | null;
};

export function ProjectCalendar({
  projectId,
  icalUrl,
  events,
}: {
  projectId: string;
  icalUrl: string;
  events: CalendarEvent[];
}) {
  const appTimeZone = useAppTimeZone();
  const [pending, startTransition] = useTransition();

  function onDelete(id: string, scheduledAt: string) {
    const date = new Date(scheduledAt);
    if (!window.confirm(`Besichtigung am ${formatDateTimeDe(date, appTimeZone)} wirklich löschen?`)) {
      return;
    }
    startTransition(() => deleteViewingAction(id));
  }

  function onUpdate(id: string, formData: FormData) {
    normalizeScheduledAtFormData(formData);
    startTransition(() => updateViewingAction(id, formData));
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
  const upcoming = sorted.filter((e) => new Date(e.scheduledAt) >= new Date());
  const past = sorted.filter((e) => new Date(e.scheduledAt) < new Date());

  return (
    <div className="space-y-6">
      <div className="bg-pn-bg-surface border border-pn-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-2">iCal-Feed</h3>
        <p className="text-sm text-pn-text-secondary mb-3">
          Alle Besichtigungstermine in Google Calendar, Outlook oder Apple Kalender abonnieren:
        </p>
        <code className="block text-xs bg-pn-bg-subtle p-3 rounded-lg break-all">{icalUrl}</code>
        <button
          type="button"
          className="mt-3 text-sm text-pn-accent hover:underline"
          onClick={() => navigator.clipboard.writeText(icalUrl)}
        >
          URL kopieren
        </button>
      </div>

      <CalendarSection
        title="Kommende Termine"
        events={upcoming}
        projectId={projectId}
        appTimeZone={appTimeZone}
        empty="Keine geplanten Besichtigungen."
        pending={pending}
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
      <CalendarSection
        title="Vergangene Termine"
        events={past}
        projectId={projectId}
        appTimeZone={appTimeZone}
        empty="Keine vergangenen Termine."
        pending={pending}
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    </div>
  );
}

function CalendarSection({
  title,
  events,
  projectId,
  appTimeZone,
  empty,
  pending,
  onDelete,
  onUpdate,
}: {
  title: string;
  events: CalendarEvent[];
  projectId: string;
  appTimeZone: string;
  empty: string;
  pending: boolean;
  onDelete: (id: string, scheduledAt: string) => void;
  onUpdate: (id: string, formData: FormData) => void;
}) {
  return (
    <section>
      <h3 className="font-semibold mb-3">{title}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-pn-text-tertiary">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const date = new Date(e.scheduledAt);
            return (
              <li
                key={e.id}
                className="bg-pn-bg-surface border border-pn-border rounded-lg px-4 py-3"
              >
                <div className="mb-3">
                  <p className="font-medium text-sm">
                    {formatDateTimeDe(date, appTimeZone)}
                  </p>
                  <Link
                    href={`/project/${projectId}/apartment/${e.apartmentId}`}
                    className="text-sm text-pn-accent hover:underline"
                  >
                    {e.apartmentTitle}
                  </Link>
                  {e.note && <p className="text-xs text-pn-text-tertiary mt-1">{e.note}</p>}
                </div>
                <form
                  action={(formData) => onUpdate(e.id, formData)}
                  className="flex flex-wrap gap-2 items-end"
                  data-unsaved-track
                  data-unsaved-label={`Besichtigung ${e.apartmentTitle}`}
                >
                  <label className="flex flex-col text-sm w-full min-w-0 sm:min-w-[190px] sm:flex-1">
                    <span className="text-pn-text-secondary mb-1">Datum & Uhrzeit</span>
                    <input
                      type="datetime-local"
                      name="scheduledAt"
                      required
                      defaultValue={toDatetimeLocalValue(date)}
                      disabled={pending}
                      className="border border-pn-border rounded-lg px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col text-sm w-full min-w-0 sm:min-w-[190px] sm:flex-[2]">
                    <span className="text-pn-text-secondary mb-1">Notiz</span>
                    <input
                      type="text"
                      name="note"
                      defaultValue={e.note ?? ""}
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
                    onClick={() => onDelete(e.id, e.scheduledAt)}
                    className="border border-pn-border px-4 py-2 rounded-lg text-sm text-pn-text-secondary hover:text-pn-score-low disabled:opacity-50 w-full sm:w-auto"
                  >
                    Löschen
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
