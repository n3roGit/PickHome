"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeDe } from "@/lib/dates";
import { useAppTimeZone } from "@/lib/use-app-timezone";

type BackupJobSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  retainCount: number;
  directory: string;
  resolvedDirectory: string;
  lastRunAt: string | null;
};

type StoredBackupFile = {
  name: string;
  sizeBytes: number;
  modifiedAt: string;
  exportedAt: string | null;
  appVersion: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const settingsErrors: Record<string, string> = {
  invalid_hour: "Ungültige Stunde (0–23).",
  invalid_minute: "Ungültige Minute (0–59).",
  invalid_retain_count: "Aufbewahrung muss zwischen 1 und 365 liegen.",
  invalid_directory: "Verzeichnis muss innerhalb des Datenverzeichnisses liegen.",
};

export function AdminScheduledBackupPanel() {
  const appTimeZone = useAppTimeZone();
  const [settings, setSettings] = useState<BackupJobSettings | null>(null);
  const [files, setFiles] = useState<StoredBackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, filesRes] = await Promise.all([
        fetch("/api/admin/backup/settings"),
        fetch("/api/admin/backup/files"),
      ]);
      if (!settingsRes.ok || !filesRes.ok) {
        setError("Daten konnten nicht geladen werden.");
        return;
      }
      const settingsData = (await settingsRes.json()) as { settings: BackupJobSettings };
      const filesData = (await filesRes.json()) as { files: StoredBackupFile[] };
      setSettings(settingsData.settings);
      setFiles(filesData.files);
    } catch {
      setError("Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/backup/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await res.json()) as { settings?: BackupJobSettings; error?: string };
      if (!res.ok) {
        setError(settingsErrors[data.error ?? ""] ?? "Einstellungen konnten nicht gespeichert werden.");
        return;
      }
      setSettings(data.settings ?? settings);
      setMessage("Einstellungen gespeichert.");
      await loadData();
    } catch {
      setError("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/backup/run", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; fileName?: string; error?: string; removed?: string[] };
      if (!res.ok) {
        setError(data.error === "backup_already_running" ? "Backup läuft bereits." : "Backup fehlgeschlagen.");
        return;
      }
      const removedNote =
        data.removed && data.removed.length > 0
          ? ` ${data.removed.length} ältere Datei(en) entfernt.`
          : "";
      setMessage(`Backup erstellt: ${data.fileName}.${removedNote}`);
      await loadData();
    } catch {
      setError("Backup fehlgeschlagen.");
    } finally {
      setRunning(false);
    }
  }

  async function handleRestore(fileName: string) {
    if (
      !confirm(
        "Alle aktuellen Daten (Datenbank und Uploads) werden durch dieses Backup ersetzt. Fortfahren?"
      )
    ) {
      return;
    }

    const keepPrevious = confirm(
      "Vorherige Daten als *.pre-import-* behalten? (Abbrechen = nein)"
    );

    setRestoring(fileName);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/backup/files/${encodeURIComponent(fileName)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepPrevious }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Wiederherstellung fehlgeschlagen.");
        return;
      }
      setMessage(
        "Wiederherstellung abgeschlossen. Bitte den Container bzw. die App neu starten (z. B. docker compose restart)."
      );
    } catch {
      setError("Wiederherstellung fehlgeschlagen.");
    } finally {
      setRestoring(null);
    }
  }

  async function handleDelete(fileName: string) {
    if (!confirm(`Backup „${fileName}" endgültig löschen?`)) return;

    setDeleting(fileName);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/backup/files/${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      setMessage(`Backup „${fileName}" gelöscht.`);
      await loadData();
    } catch {
      setError("Löschen fehlgeschlagen.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-8">
      <h2 className="font-semibold mb-2">Automatische Sicherung</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Regelmäßiger Export in ein Verzeichnis auf dem Server. Ältere Dateien werden nach der
        konfigurierten Anzahl automatisch entfernt.
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

      {loading || !settings ? (
        <p className="text-sm text-pn-text-secondary">Lade Einstellungen…</p>
      ) : (
        <>
          <form
            onSubmit={handleSave}
            className="space-y-4 border-b border-pn-border pb-4 mb-4"
            data-unsaved-track
            data-unsaved-label="Auto-Backup"
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                name="enabled"
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                disabled={saving}
              />
              Automatische Sicherung aktiv
            </label>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm">
                <span className="block mb-1 text-pn-text-secondary">
                  Uhrzeit ({appTimeZone})
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={settings.hour}
                    onChange={(e) =>
                      setSettings({ ...settings, hour: Number(e.target.value) })
                    }
                    disabled={saving}
                    className="border border-pn-border rounded-lg px-2 py-1 w-16"
                  />
                  <span>:</span>
                  <input
                    name="minute"
                    type="number"
                    min={0}
                    max={59}
                    value={settings.minute}
                    onChange={(e) =>
                      setSettings({ ...settings, minute: Number(e.target.value) })
                    }
                    disabled={saving}
                    className="border border-pn-border rounded-lg px-2 py-1 w-16"
                  />
                </div>
              </label>

              <label className="text-sm">
                <span className="block mb-1 text-pn-text-secondary">Backups behalten</span>
                <input
                  name="retainCount"
                  type="number"
                  min={1}
                  max={365}
                  value={settings.retainCount}
                  onChange={(e) =>
                    setSettings({ ...settings, retainCount: Number(e.target.value) })
                  }
                  disabled={saving}
                  className="border border-pn-border rounded-lg px-2 py-1 w-full"
                />
              </label>

              <label className="text-sm sm:col-span-1">
                <span className="block mb-1 text-pn-text-secondary">Unterverzeichnis (optional)</span>
                <input
                  name="directory"
                  type="text"
                  value={settings.directory}
                  placeholder="backups"
                  onChange={(e) => setSettings({ ...settings, directory: e.target.value })}
                  disabled={saving}
                  className="border border-pn-border rounded-lg px-2 py-1 w-full font-mono text-xs"
                />
              </label>
            </div>

            <p className="text-xs text-pn-text-secondary font-mono break-all">
              Ziel: {settings.resolvedDirectory}
            </p>
            {settings.lastRunAt && (
              <p className="text-xs text-pn-text-secondary">
                Letzter Lauf: {formatDateTimeDe(new Date(settings.lastRunAt), appTimeZone)}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? "Speichern…" : "Einstellungen speichern"}
              </button>
              <button
                type="button"
                onClick={() => void handleRunNow()}
                disabled={running}
                className="border border-pn-border font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {running ? "Backup läuft…" : "Jetzt sichern"}
              </button>
            </div>
          </form>

          <div>
            <h3 className="text-sm font-semibold mb-3">
              Gespeicherte Backups ({files.length})
            </h3>
            {files.length === 0 ? (
              <p className="text-sm text-pn-text-secondary">Noch keine Backups im Zielverzeichnis.</p>
            ) : (
              <div className="overflow-x-auto border border-pn-border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-pn-bg-subtle text-left">
                    <tr>
                      <th className="p-3">Datei</th>
                      <th className="p-3">Erstellt</th>
                      <th className="p-3">Größe</th>
                      <th className="p-3">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.name} className="border-t border-pn-border">
                        <td className="p-3 font-mono text-xs">{file.name}</td>
                        <td className="p-3">
                          {formatDateTimeDe(
                            new Date(file.exportedAt ?? file.modifiedAt),
                            appTimeZone
                          )}
                        </td>
                        <td className="p-3">{formatBytes(file.sizeBytes)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <a
                            href={`/api/admin/backup/files/${encodeURIComponent(file.name)}`}
                            className="text-pn-accent text-xs hover:underline mr-3"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleRestore(file.name)}
                            disabled={restoring === file.name}
                            className="text-pn-accent text-xs hover:underline mr-3 disabled:opacity-50"
                          >
                            {restoring === file.name ? "…" : "Wiederherstellen"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(file.name)}
                            disabled={deleting === file.name}
                            className="text-pn-score-low text-xs hover:underline disabled:opacity-50"
                          >
                            {deleting === file.name ? "…" : "Löschen"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
