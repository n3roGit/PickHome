"use client";

import Link from "next/link";
import { formatDateTimeDe } from "@/lib/dates";
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
        empty="Keine geplanten Besichtigungen."
      />
      <CalendarSection
        title="Vergangene Termine"
        events={past}
        projectId={projectId}
        empty="Keine vergangenen Termine."
      />
    </div>
  );
}

function CalendarSection({
  title,
  events,
  projectId,
  empty,
}: {
  title: string;
  events: CalendarEvent[];
  projectId: string;
  empty: string;
}) {
  return (
    <section>
      <h3 className="font-semibold mb-3">{title}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-pn-text-tertiary">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 bg-pn-bg-surface border border-pn-border rounded-lg px-4 py-3"
            >
              <div>
                <p className="font-medium text-sm">
                  {formatDateTimeDe(new Date(e.scheduledAt), appTimeZone)}
                </p>
                <Link
                  href={`/project/${projectId}/apartment/${e.apartmentId}`}
                  className="text-sm text-pn-accent hover:underline"
                >
                  {e.apartmentTitle}
                </Link>
                {e.note && <p className="text-xs text-pn-text-tertiary mt-1">{e.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
