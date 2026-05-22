import {
  apartmentLlmHasSourceText,
  buildApartmentLlmContext,
  type ApartmentLlmContextInput,
} from "@/lib/apartment-llm-context";
import type { LlmChatCompletionMessage } from "@/lib/llm-client";
import { runLlmChatWithOptionalWebSearch } from "@/lib/llm-tools";
import { resolveLlmSystemPrompt } from "@/lib/llm-settings";
import { isWebSearchConfigured } from "@/lib/web-search-settings";

const APARTMENT_CHAT_TASK_SOURCES_ONLY = `Im aktuellen Gespräch beantwortest du Fragen ausschließlich zur unten angegebenen Immobilie.
Nutze nur Stammdaten, Beschreibung, Notizen und Dokumente.
Fehlende oder unklare Angaben benennst du offen — ohne Schätzen oder Ergänzen aus Allgemeinwissen.`;

const APARTMENT_CHAT_TASK_WITH_WEB = `Im aktuellen Gespräch beantwortest du Fragen zur unten angegebenen Immobilie.

Quellen (Priorität):
1. Stammdaten, Beschreibung, Notizen und Dokumente der Immobilie
2. Tool web_search für öffentliche Recherche (z. B. typische Sanierungskosten, Marktpreise), nur wenn (1) nicht ausreicht

Wichtig:
- Nutze das bereitgestellte Tool web_search — gib niemals rohes JSON wie {"type":"web_search",…} als Antwort aus.
- Nach einer Suche fasse die Treffer in normaler deutscher Prosa zusammen.

Verhalten:
- Fehlen entscheidende Angaben (z. B. Sanierungsumfang, Zustand, Gewerke, genaue Lage), stelle zuerst klare Rückfragen — erfinde keine Details.
- Grobe Schätzungen nur mit expliziten Annahmen und dem Hinweis „grobe Orientierung, keine verbindliche Kalkulation“.
- Zahlen aus dem Web nur bei tatsächlichen Suchtreffern; nenne kurz Quelle (Titel oder Domain).
- Ohne belastbare Daten: sage das offen. Behaupte nichts als Fakt.
- Kombiniere Immobiliendaten und Web-Recherche transparent.`;

export async function buildApartmentChatSystemPrompt(
  apartment: ApartmentLlmContextInput
): Promise<string> {
  const context = buildApartmentLlmContext(apartment);
  const basePrompt = await resolveLlmSystemPrompt();
  const webSearch = await isWebSearchConfigured();
  const task = webSearch ? APARTMENT_CHAT_TASK_WITH_WEB : APARTMENT_CHAT_TASK_SOURCES_ONLY;
  return `${basePrompt}\n\n${task}\n\n--- Immobilie ---\n${context}`;
}

export async function answerApartmentLlmQuestion(input: {
  apartment: ApartmentLlmContextInput;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<
  | { ok: true; answer: string; webSearchEnabled: boolean; webSearchUsed: boolean }
  | { ok: false; error: string }
> {
  if (!apartmentLlmHasSourceText(input.apartment)) {
    return { ok: false, error: "no_source_text" };
  }

  const webSearchEnabled = await isWebSearchConfigured();
  const systemContent = await buildApartmentChatSystemPrompt(input.apartment);
  const chatMessages: LlmChatCompletionMessage[] = [
    { role: "system", content: systemContent },
    ...input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const result = await runLlmChatWithOptionalWebSearch(chatMessages, {
    maxTokens: 2000,
    temperature: 0.3,
    timeoutMs: 120_000,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    answer: result.content,
    webSearchEnabled,
    webSearchUsed: result.webSearchUsed,
  };
}
