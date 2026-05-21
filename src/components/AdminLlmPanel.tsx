"use client";

import { useCallback, useEffect, useState } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_base_url: "Ungültige Basis-URL (http oder https).",
  base_url_too_long: "Basis-URL ist zu lang.",
  api_key_too_long: "API-Token ist zu lang.",
  model_too_long: "Modell-ID ist zu lang.",
  system_prompt_too_long: "System-Prompt ist zu lang.",
  not_configured: "Bitte zuerst Basis-URL und API-Token speichern.",
  request_failed: "Server hat die Anfrage abgelehnt.",
  fetch_failed: "Verbindung zum Server fehlgeschlagen.",
};

export function AdminLlmPanel() {
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState("");
  const [systemPromptIsDefault, setSystemPromptIsDefault] = useState(true);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/llm");
      if (!res.ok) {
        setError("Einstellungen konnten nicht geladen werden.");
        return;
      }
      const data = (await res.json()) as {
        baseUrl: string | null;
        apiKeyConfigured: boolean;
        model: string | null;
        systemPrompt: string;
        systemPromptIsDefault: boolean;
        defaultSystemPrompt: string;
      };
      setBaseUrl(data.baseUrl ?? "");
      setModel(data.model ?? "");
      setSystemPrompt(data.systemPrompt ?? "");
      setDefaultSystemPrompt(data.defaultSystemPrompt ?? "");
      setSystemPromptIsDefault(Boolean(data.systemPromptIsDefault));
      setApiKeyConfigured(data.apiKeyConfigured);
      setApiKey("");
      setClearApiKey(false);
    } catch {
      setError("Einstellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function formatError(code: string | undefined, detail?: string) {
    const base = (code && ERROR_MESSAGES[code]) || "Aktion fehlgeschlagen.";
    if (detail && code !== "not_configured") {
      return `${base} (${detail.slice(0, 120)})`;
    }
    return base;
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload: { baseUrl: string; model: string; systemPrompt: string; apiKey?: string } = {
      baseUrl,
      model,
      systemPrompt,
    };
    if (clearApiKey) {
      payload.apiKey = "";
    } else if (apiKey.trim()) {
      payload.apiKey = apiKey;
    }

    try {
      const res = await fetch("/api/admin/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        baseUrl?: string | null;
        model?: string | null;
        systemPrompt?: string;
        systemPromptIsDefault?: boolean;
        apiKeyConfigured?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(formatError(data.error));
        return;
      }
      setBaseUrl(data.baseUrl ?? "");
      setModel(data.model ?? "");
      setSystemPrompt(data.systemPrompt ?? "");
      setSystemPromptIsDefault(Boolean(data.systemPromptIsDefault));
      setApiKeyConfigured(Boolean(data.apiKeyConfigured));
      setApiKey("");
      setClearApiKey(false);
      setMessage("KI-Anbindung gespeichert.");
    } catch {
      setError("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings/llm/test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok || !data.ok) {
        setError(formatError(data.error, data.detail));
        return;
      }
      setMessage("Verbindung erfolgreich (GET /models).");
    } catch {
      setError("Verbindungstest fehlgeschlagen.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-8">
      <h2 className="font-semibold mb-2">KI-Anbindung (OpenAI-kompatibel)</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Globale Einstellungen für KI-Funktionen in PickHome (Exposé-Chat, Extraktion aus PDFs):
        Anbindung, Modell und System-Prompt. Der Dienst muss eine OpenAI-kompatible API
        bereitstellen — üblicherweise eine Basis-URL mit{" "}
        <span className="font-mono text-xs">/v1</span>. Der System-Prompt wird bei jeder
        Anfrage mitgeschickt. Werte werden auf dem Server gespeichert; der API-Token wird nach
        dem Speichern nicht erneut angezeigt.
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
        <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
          <label className="block text-sm">
            <span className="block mb-1 text-pn-text-secondary">Basis-URL</span>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={saving}
              placeholder="https://api.openai.com/v1"
              className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full font-mono"
              autoComplete="off"
            />
          </label>

          <label className="block text-sm">
            <span className="block mb-1 text-pn-text-secondary">Modell</span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={saving}
              placeholder="auto-fastest"
              className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full font-mono"
              autoComplete="off"
            />
            <span className="mt-1 block text-xs text-pn-text-tertiary">
              Modell-ID für <span className="font-mono">/chat/completions</span> (z. B. aus GET{" "}
              <span className="font-mono">/models</span>).
            </span>
          </label>

          <label className="block text-sm">
            <span className="block mb-1 text-pn-text-secondary">System-Prompt</span>
            <textarea
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                setSystemPromptIsDefault(false);
              }}
              disabled={saving}
              rows={8}
              className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full resize-y"
            />
            <span className="mt-1 block text-xs text-pn-text-tertiary">
              {systemPromptIsDefault
                ? "Standard-Prompt der Anwendung (wird bei leerem Speichern verwendet)."
                : "Eigener Prompt — wird bei jeder KI-Anfrage als System-Nachricht gesendet."}
            </span>
            {defaultSystemPrompt && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSystemPrompt(defaultSystemPrompt);
                  setSystemPromptIsDefault(true);
                }}
                className="mt-2 text-xs text-pn-accent hover:underline disabled:opacity-50"
              >
                Standard-Prompt wiederherstellen
              </button>
            )}
          </label>

          <label className="block text-sm">
            <span className="block mb-1 text-pn-text-secondary">API-Token</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setClearApiKey(false);
              }}
              disabled={saving}
              placeholder={
                apiKeyConfigured ? "••••••••  (leer lassen = unverändert)" : "sk-…"
              }
              className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full font-mono"
              autoComplete="new-password"
            />
            {apiKeyConfigured && (
              <label className="mt-2 flex items-center gap-2 text-pn-text-secondary">
                <input
                  type="checkbox"
                  checked={clearApiKey}
                  onChange={(e) => {
                    setClearApiKey(e.target.checked);
                    if (e.target.checked) setApiKey("");
                  }}
                  disabled={saving}
                />
                Gespeicherten Token entfernen
              </label>
            )}
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
            <button
              type="button"
              disabled={saving || testing || (!baseUrl.trim() && !apiKeyConfigured)}
              onClick={() => void handleTest()}
              className="border border-pn-border bg-pn-bg-subtle font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {testing ? "Teste…" : "Verbindung testen"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
