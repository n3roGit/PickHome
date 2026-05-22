"use client";

import { useEffect, useRef, useState } from "react";
import { APARTMENT_TOOLBAR_BTN_ACCENT } from "@/lib/apartment-toolbar-styles";

type ChatTurn = { role: "user" | "assistant"; content: string };

const ERROR_MESSAGES: Record<string, string> = {
  llm_not_configured: "KI ist nicht konfiguriert (Admin → KI).",
  no_source_text: "Kein Exposé-Text — PDF hochladen und indexieren lassen.",
  not_configured: "KI ist nicht konfiguriert.",
  invalid_message: "Bitte eine Frage eingeben.",
  fetch_failed: "Verbindung zur KI fehlgeschlagen.",
  request_failed: "KI-Anfrage fehlgeschlagen.",
  empty_response: "Leere Antwort von der KI.",
};

export function ApartmentLlmChatButton({
  apartmentId,
  hasSourceText,
  toolbar,
}: {
  apartmentId: string;
  hasSourceText: boolean;
  toolbar?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, history, loading]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setInput("");
    setError(null);
    const userTurn: ChatTurn = { role: "user", content: message };
    setHistory((h) => [...h, userTurn]);
    setLoading(true);

    try {
      const res = await fetch(`/api/apartments/${apartmentId}/llm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.slice(-10),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; answer?: string; error?: string };
      if (!res.ok || !data.answer) {
        setError(ERROR_MESSAGES[data.error ?? ""] ?? "Antwort fehlgeschlagen.");
        setHistory((h) => h.slice(0, -1));
        return;
      }
      setHistory((h) => [...h, { role: "assistant", content: data.answer! }]);
    } catch {
      setError("Netzwerkfehler.");
      setHistory((h) => h.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasSourceText}
        title={
          hasSourceText
            ? "KI-Assistent — Fragen zur Immobilie, optional mit Web-Recherche"
            : "PDF mit Textindex erforderlich oder Beschreibung/Notizen"
        }
        aria-label="KI-Assistent"
        className={
          toolbar
            ? `${APARTMENT_TOOLBAR_BTN_ACCENT} disabled:border-pn-border disabled:text-pn-text-tertiary`
            : "text-sm border border-pn-accent text-pn-accent px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle disabled:opacity-40 disabled:border-pn-border disabled:text-pn-text-tertiary"
        }
      >
        KI
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="llm-chat-title"
        >
          <div className="bg-pn-bg-surface border border-pn-border rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-lg">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-pn-border">
              <div>
                <h2 id="llm-chat-title" className="text-lg font-semibold">
                  Immobilien-Assistent
                </h2>
                <p className="text-xs text-pn-text-secondary mt-1">
                  Nutzt Immobiliendaten und Dokumente; optional Web-Recherche (DuckDuckGo).
                  Bei Unklarheiten fragt die KI nach — keine erfundenen Fakten.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-pn-text-secondary hover:text-pn-text-primary text-xl leading-none px-1"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[50vh]"
            >
              {history.length === 0 && (
                <p className="text-sm text-pn-text-secondary">
                  z. B. „Was steht zur Heizung?“, „Wie hoch könnten Sanierungskosten sein?“ (grobe
                  Schätzung mit Annahmen)
                </p>
              )}
              {history.map((turn, i) => (
                <div
                  key={`${turn.role}-${i}`}
                  className={`text-sm rounded-lg px-3 py-2 whitespace-pre-wrap ${
                    turn.role === "user"
                      ? "bg-pn-bg-subtle ml-8"
                      : "bg-pn-score-high-bg mr-4"
                  }`}
                >
                  {turn.content}
                </div>
              ))}
              {loading && (
                <p className="text-sm text-pn-text-tertiary italic" aria-live="polite">
                  tippt…
                </p>
              )}
            </div>

            {error && (
              <p className="mx-4 mb-2 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <form onSubmit={sendMessage} className="p-4 border-t border-pn-border flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                placeholder="Frage zur Immobilie…"
                className="flex-1 border border-pn-border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Senden
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
