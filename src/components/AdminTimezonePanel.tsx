"use client";

import { useCallback, useEffect, useState } from "react";
import { invalidateAppTimeZoneCache } from "@/lib/use-app-timezone";
import { APP_TIME_ZONE_OPTIONS } from "@/lib/timezone";

export function AdminTimezonePanel() {
  const [timeZone, setTimeZone] = useState("Europe/Berlin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/timezone");
      if (!res.ok) {
        setError("Einstellungen konnten nicht geladen werden.");
        return;
      }
      const data = (await res.json()) as { timeZone: string };
      setTimeZone(data.timeZone);
    } catch {
      setError("Einstellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings/timezone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone }),
      });
      const data = (await res.json()) as { timeZone?: string; error?: string };
      if (!res.ok) {
        setError(
          data.error === "invalid_timezone"
            ? "Ungültige Zeitzone."
            : "Einstellungen konnten nicht gespeichert werden."
        );
        return;
      }
      if (data.timeZone) {
        setTimeZone(data.timeZone);
        invalidateAppTimeZoneCache();
      }
      setMessage("Zeitzone gespeichert.");
    } catch {
      setError("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-8">
      <h2 className="font-semibold mb-2">Zeitzone</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Globale Anzeige von Datum und Uhrzeit in der gesamten Anwendung sowie Planung
        automatischer Backups nach dieser Zeitzone.
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

      {loading ? (
        <p className="text-sm text-pn-text-secondary">Lade Einstellungen…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <label className="block text-sm">
            <span className="block mb-1 text-pn-text-secondary">Zeitzone (IANA)</span>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              disabled={saving}
              className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full"
            >
              {APP_TIME_ZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </form>
      )}
    </section>
  );
}
