import {
  apartmentLlmHasSourceText,
  buildApartmentLlmContext,
  type ApartmentLlmContextInput,
} from "@/lib/apartment-llm-context";
import type { LlmChatCompletionMessage } from "@/lib/llm-client";
import { runLlmChatWithOptionalWebSearch } from "@/lib/llm-tools";
import { resolveLlmSystemPrompt } from "@/lib/llm-settings";
import { isWebSearchConfigured } from "@/lib/web-search-settings";

const APARTMENT_CHAT_HISTORY_RULES = `Chatverlauf (wichtig):
- Nach dem System-Prompt folgen user-/assistant-Nachrichten: das ist der laufende Dialog in diesem Immobilien-Chatfenster.
- Jede Anfrage enthält den vollständigen bisherigen Verlauf — nutze ihn immer (Folgefragen, „was habe ich gefragt?“, „fasse zusammen“).
- Behaupte niemals, es gäbe keine vorherigen Fragen oder Nachrichten, wenn im Verlauf bereits user-Nachrichten stehen.
- Meta-Fragen zum Gespräch beantwortest du aus dem Verlauf; Immobilienfragen aus Verlauf plus Stammdaten/Dokumenten unten.`;

const APARTMENT_CHAT_ESTIMATE_RULES = `PickHome-Schätzungen:
- Abschnitte mit „(PickHome-Schätzung …)“, „grobe Orientierung“ oder „Finanz-Schätzung“ sind rechnerische Annahmen, keine verbindlichen Fakten.
- Nutze Finanz-, Fahrtwege- und Checklisten-Abschnitte, wenn sie zur Frage passen, aber kennzeichne Schätzwerte immer als grobe Orientierung.
- Nenne fehlende Annahmen (z. B. fehlendes Haushaltsnetto, nicht berechnete Route) offen — erfinde keine Zahlen.`;

const APARTMENT_CHAT_TASK_SOURCES_ONLY = `Im aktuellen Gespräch beantwortest du Fragen ausschließlich zur unten angegebenen Immobilie.
Nutze Stammdaten, Beschreibung, Notizen, Dokumente, Checkliste und — falls vorhanden — die Abschnitte „Finanz-Schätzung (PickHome …)“, „Fahrtwege (PickHome-Schätzung …)“, „Besichtigungstermine“, „Preisverlauf“, „Bodenrichtwert (BORIS)“, „Förder-Hinweise (PickHome)“ sowie „Bewertungskriterien (PickHome)“ (Gewichtung, Team-Bewertungen, Gesamtscore).
Die Bewertungen stehen dort im Format „Name: X/10“ — nutze sie direkt, ohne erneut nach Punkten zu fragen.
${APARTMENT_CHAT_ESTIMATE_RULES}
${APARTMENT_CHAT_HISTORY_RULES}
Du darfst intern denken, antwortest dem Nutzer aber nur mit der finalen, kurzen Antwort — ohne Denkprozess oder Meta-Kommentare.
Fehlende oder unklare Angaben benennst du offen — ohne Schätzen oder Ergänzen aus Allgemeinwissen.`;

const APARTMENT_CHAT_TASK_WITH_WEB = `Im aktuellen Gespräch beantwortest du Fragen zur unten angegebenen Immobilie.

Quellen (Priorität):
1. Stammdaten, Beschreibung, Notizen, Dokumente, Checkliste, Bewertungskriterien, Besichtigungstermine, Preisverlauf, Bodenrichtwert (BORIS), Förder-Hinweise und PickHome-Schätzungen (Finanz, Fahrtwege)
2. Tool web_search für öffentliche Recherche (z. B. typische Sanierungskosten, Marktpreise), nur wenn (1) nicht ausreicht

Wichtig:
- Nutze das bereitgestellte Tool web_search — gib niemals rohes JSON wie {"type":"web_search",…} als Antwort aus.
- Nach einer Suche fasse die Treffer in normaler deutscher Prosa zusammen.
- Bewertungen stehen unter „Bewertungskriterien (PickHome)“ als „Name: X/10“.
- ${APARTMENT_CHAT_ESTIMATE_RULES}
- ${APARTMENT_CHAT_HISTORY_RULES}
- Du darfst intern denken; die Nutzerantwort ist nur die finale Zusammenfassung ohne Denkprozess.
- Explizite Bitte um Internetsuche (z. B. „suche im Internet“) → web_search ausführen, auch wenn das Exposé ähnliche Infos enthält.

Verhalten:
- Fehlen entscheidende Angaben (z. B. Sanierungsumfang, Zustand, Gewerke, genaue Lage), stelle zuerst klare Rückfragen — erfinde keine Details.
- Grobe Schätzungen nur mit expliziten Annahmen und dem Hinweis „grobe Orientierung, keine verbindliche Kalkulation“.
- Zahlen aus dem Web nur bei tatsächlichen Suchtreffern; nenne kurz Quelle (Titel oder Domain).
- Ohne belastbare Daten: sage das offen. Behaupte nichts als Fakt.
- Kombiniere Immobiliendaten und Web-Recherche transparent.`;

export type ApartmentChatTurn = { role: "user" | "assistant"; content: string };

/** Recap prior turns in the system prompt so models do not ignore short chat history. */
export function formatApartmentChatHistoryRecap(
  messages: ApartmentChatTurn[]
): string {
  const prior = messages.filter((m) => m.content.trim());
  if (prior.length === 0) return "";

  const lines = prior.map((m) => {
    const label = m.role === "user" ? "Nutzer" : "Assistent";
    return `${label}: ${m.content.trim()}`;
  });

  return [
    "",
    "--- Bisheriger Chatverlauf (dieses Fenster, chronologisch) ---",
    ...lines,
    "--- Ende Chatverlauf ---",
  ].join("\n");
}

export async function buildApartmentChatSystemPrompt(
  apartment: ApartmentLlmContextInput,
  priorMessages: ApartmentChatTurn[] = []
): Promise<string> {
  const context = buildApartmentLlmContext(apartment);
  const basePrompt = await resolveLlmSystemPrompt();
  const webSearch = await isWebSearchConfigured();
  const task = webSearch ? APARTMENT_CHAT_TASK_WITH_WEB : APARTMENT_CHAT_TASK_SOURCES_ONLY;
  const recap = formatApartmentChatHistoryRecap(priorMessages);
  return `${basePrompt}\n\n${task}${recap}\n\n--- Immobilie ---\n${context}`;
}

export async function answerApartmentLlmQuestion(input: {
  apartment: ApartmentLlmContextInput;
  messages: ApartmentChatTurn[];
}): Promise<
  | { ok: true; answer: string; webSearchEnabled: boolean; webSearchUsed: boolean }
  | { ok: false; error: string }
> {
  if (!apartmentLlmHasSourceText(input.apartment)) {
    return { ok: false, error: "no_source_text" };
  }

  const turns = input.messages
    .filter((m) => m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim() }));
  if (turns.length === 0 || turns[turns.length - 1]?.role !== "user") {
    return { ok: false, error: "invalid_message" };
  }

  const priorTurns = turns.slice(0, -1);
  const webSearchEnabled = await isWebSearchConfigured();
  const systemContent = await buildApartmentChatSystemPrompt(input.apartment, priorTurns);
  const chatMessages: LlmChatCompletionMessage[] = [
    { role: "system", content: systemContent },
    ...turns.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const result = await runLlmChatWithOptionalWebSearch(chatMessages, {
    maxTokens: 8192,
    temperature: 0.3,
    timeoutMs: 180_000,
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
