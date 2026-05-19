"use client";

import { useState } from "react";

export function AdminBackupPanel() {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("backup") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Bitte eine ZIP-Datei auswählen.");
      return;
    }

    if (
      !confirm(
        "Alle aktuellen Daten (Datenbank und Uploads) werden ersetzt. Fortfahren?"
      )
    ) {
      return;
    }

    setImporting(true);
    try {
      const fd = new FormData(form);
      const res = await fetch("/api/admin/backup/import", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; restartRequired?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Import fehlgeschlagen.");
        return;
      }
      setMessage(
        "Import abgeschlossen. Bitte den Container bzw. die App neu starten (z. B. docker compose restart)."
      );
      form.reset();
    } catch {
      setError("Import fehlgeschlagen.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-8">
      <h2 className="font-semibold mb-2">Daten exportieren / importieren</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Vollständige Sicherung: SQLite-Datenbank und alle Uploads (Fotos, PDFs). ZIP auf
        einem anderen Server wieder einspielen.
      </p>

      {message && (
        <p className="mb-4 text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-4 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <a
          href="/api/admin/backup/export"
          className="inline-flex bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Backup herunterladen (ZIP)
        </a>
      </div>

      <form onSubmit={handleImport} className="space-y-3 border-t border-pn-border pt-4">
        <h3 className="text-sm font-semibold">Backup importieren</h3>
        <input
          name="backup"
          type="file"
          accept=".zip,application/zip"
          required
          disabled={importing}
          className="block w-full text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-pn-text-secondary">
          <input name="keepPrevious" type="checkbox" value="1" disabled={importing} />
          Vorherige Daten als <code className="text-xs">*.pre-import-*</code> behalten
        </label>
        <button
          type="submit"
          disabled={importing}
          className="bg-pn-score-low text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {importing ? "Import läuft…" : "Backup importieren"}
        </button>
      </form>
    </section>
  );
}
