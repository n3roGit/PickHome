"use client";

import { useCallback, useEffect, useState } from "react";
import {
  reindexProjectAddressesAction,
  reindexProjectCommuteAction,
  reindexProjectDocumentsAction,
} from "@/app/actions";
import type { ProjectReindexJobView } from "@/lib/project-reindex-jobs";
import { formatDocumentsReindexMessage } from "@/lib/project-reindex-messages";

type ReindexJobsResponse = {
  documents: ProjectReindexJobView | null;
  commute: ProjectReindexJobView | null;
  addresses: ProjectReindexJobView | null;
  commutePendingLegs: number;
  commuteTotalLegs: number;
};

const reindexErrors: Record<string, string> = {
  already_running: "Es läuft bereits ein Indizierungsvorgang.",
};

function jobMessage(job: ProjectReindexJobView | null): string | null {
  if (!job) return null;
  if (job.status === "running") {
    if (job.kind === "documents") {
      return "PDFs werden eingelesen — du kannst die App weiter nutzen.";
    }
    if (job.kind === "addresses") {
      return "Adressen werden angereichert — du kannst die App weiter nutzen.";
    }
    return "Anfahrtszeiten werden berechnet — du kannst die App weiter nutzen.";
  }
  if (job.status === "failed") {
    return "Indizierung fehlgeschlagen.";
  }
  if (job.kind === "documents" && job.documentsResult) {
    return formatDocumentsReindexMessage(job.documentsResult);
  }
  if (job.kind === "addresses" && job.addressesResult) {
    const r = job.addressesResult;
    return `${r.updated} Adresse(n) angereichert (${r.processed} geprüft).`;
  }
  return null;
}

function messageClassName(job: ProjectReindexJobView | null): string {
  if (job?.status === "failed") {
    return "text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg";
  }
  if (job?.status === "running") {
    return "text-sm text-pn-text-secondary bg-pn-bg-subtle px-3 py-2 rounded-lg";
  }
  return "text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg";
}

function commutePendingStatusText(
  pending: number,
  total: number,
  running: boolean
): string {
  if (total === 0) {
    return "Keine berechenbaren Routen (Koordinaten oder Adressen fehlen).";
  }
  const progress = `${pending} von ${total} Routen`;
  if (running) {
    return pending > 0 ? `Berechnung läuft — ${progress} offen` : "Berechnung läuft…";
  }
  if (pending > 0) return `${progress} offen`;
  return `${total} von ${total} Routen berechnet`;
}

export function ProjectReindexPanel({
  projectId,
  startedKind,
  errorCode,
}: {
  projectId: string;
  startedKind?: "documents" | "commute" | "addresses";
  errorCode?: string;
}) {
  const [jobs, setJobs] = useState<ReindexJobsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/reindex`, { cache: "no-store" });
      if (!res.ok) {
        setLoadError("Status konnte nicht geladen werden.");
        return;
      }
      const data = (await res.json()) as ReindexJobsResponse;
      setJobs({
        ...data,
        commutePendingLegs: data.commutePendingLegs ?? 0,
        commuteTotalLegs: data.commuteTotalLegs ?? 0,
      });
      setLoadError(null);
    } catch {
      setLoadError("Status konnte nicht geladen werden.");
    }
  }, [projectId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs, startedKind]);

  useEffect(() => {
    const documentsRunning = jobs?.documents?.status === "running";
    const commuteRunning = jobs?.commute?.status === "running";
    const pending = jobs?.commutePendingLegs ?? 0;
    if (!documentsRunning && !commuteRunning && pending === 0) return;

    const timer = window.setInterval(() => {
      void loadJobs();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [jobs, loadJobs]);

  const documentsRunning = jobs?.documents?.status === "running";
  const commuteRunning = jobs?.commute?.status === "running";
  const addressesRunning = jobs?.addresses?.status === "running";
  const addressesMessage = jobMessage(jobs?.addresses ?? null);
  const commutePendingLegs = jobs?.commutePendingLegs ?? 0;
  const commuteTotalLegs = jobs?.commuteTotalLegs ?? 0;
  const documentsMessage = jobMessage(jobs?.documents ?? null);

  return (
    <>
      {loadError && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg max-w-lg">
          {loadError}
        </p>
      )}
      {errorCode && reindexErrors[errorCode] && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg max-w-lg">
          {reindexErrors[errorCode]}
        </p>
      )}

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 max-w-lg space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Volltextsuche</h2>
          <p className="text-sm text-pn-text-secondary">
            PDF-Exposés nachträglich einlesen, damit der Inhalt in der Suche gefunden wird.
          </p>
        </div>
        {documentsMessage && (
          <p className={messageClassName(jobs?.documents ?? null)}>{documentsMessage}</p>
        )}
        <form action={reindexProjectDocumentsAction.bind(null, projectId)}>
          <button
            type="submit"
            disabled={documentsRunning}
            className="bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-pn-border/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {documentsRunning ? "PDFs werden eingelesen…" : "PDFs neu einlesen"}
          </button>
        </form>
      </section>

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 max-w-lg space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Adressen (Wunschgebiet)</h2>
          <p className="text-sm text-pn-text-secondary">
            Stadtteil aus OpenStreetMap ergänzen, damit die Lage im
            Wunschgebiet erkannt wird. Läuft auch automatisch im Hintergrund für alle Projekte.
          </p>
        </div>
        {addressesMessage && (
          <p className={messageClassName(jobs?.addresses ?? null)}>{addressesMessage}</p>
        )}
        <form action={reindexProjectAddressesAction.bind(null, projectId)}>
          <button
            type="submit"
            disabled={addressesRunning}
            className="bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-pn-border/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {addressesRunning ? "Adressen werden angereichert…" : "Adressen jetzt anreichern"}
          </button>
        </form>
      </section>

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 max-w-lg space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Anfahrtszeiten</h2>
          <p className="text-sm text-pn-text-secondary">
            Entfernungen und Fahrzeiten aus den Koordinaten der Immobilien und der
            Team-Adressen (Kontoeinstellungen) neu berechnen. Bestehende Routen-Caches
            werden verworfen.
          </p>
        </div>
        <p
          className={`text-sm tabular-nums ${
            commutePendingLegs > 0 || commuteRunning
              ? "text-pn-text-primary font-medium"
              : "text-pn-text-secondary"
          }`}
        >
          {commutePendingStatusText(commutePendingLegs, commuteTotalLegs, commuteRunning)}
        </p>
        {jobs?.commute?.status === "failed" && (
          <p className={messageClassName(jobs.commute)}>Indizierung fehlgeschlagen.</p>
        )}
        <form action={reindexProjectCommuteAction.bind(null, projectId)}>
          <button
            type="submit"
            disabled={commuteRunning}
            className="bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-4 py-2 rounded-lg text-sm hover:bg-pn-border/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {commuteRunning ? "Anfahrtszeiten werden berechnet…" : "Koordinaten neu indizieren"}
          </button>
        </form>
      </section>
    </>
  );
}
