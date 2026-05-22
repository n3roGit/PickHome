import {
  callLlmChatCompletion,
  type LlmChatCompletionMessage,
  type LlmChatTool,
} from "@/lib/llm-client";
import { formatWebSearchHitsForLlm, runWebSearch } from "@/lib/web-search";
import { isWebSearchConfigured } from "@/lib/web-search-settings";

export const LLM_WEB_SEARCH_TOOL_NAME = "web_search";
export const LLM_MAX_TOOL_ROUNDS = 6;
export const LLM_MAX_WEB_SEARCHES_PER_TURN = 4;

export const LLM_WEB_SEARCH_TOOL: LlmChatTool = {
  type: "function",
  function: {
    name: LLM_WEB_SEARCH_TOOL_NAME,
    description:
      "Öffentliches Web nach aktuellen Informationen durchsuchen (z. B. typische Sanierungskosten, Marktpreise, Vorschriften). Nur nutzen, wenn Immobiliendaten und Dokumente nicht ausreichen.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Präzise deutsche Suchanfrage",
        },
      },
      required: ["query"],
    },
  },
};

export function parseWebSearchToolArgs(raw: string): { query: string } | null {
  try {
    const parsed = JSON.parse(raw) as { query?: unknown };
    const query = typeof parsed.query === "string" ? parsed.query.trim() : "";
    if (!query) return null;
    return { query };
  } catch {
    return null;
  }
}

/** Some models emit tool intent as plain JSON in message content instead of tool_calls. */
export function parseInlineWebSearchRequest(content: string): { query: string } | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const marker = String(parsed.type ?? parsed.name ?? parsed.function ?? "").toLowerCase();
    if (marker === LLM_WEB_SEARCH_TOOL_NAME || marker === "web_search") {
      const direct = typeof parsed.query === "string" ? parsed.query.trim() : "";
      if (direct) return { query: direct };
      const args = parsed.arguments;
      if (args && typeof args === "object" && !Array.isArray(args)) {
        const nested = (args as { query?: unknown }).query;
        if (typeof nested === "string" && nested.trim()) return { query: nested.trim() };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function syntheticToolCallId(round: number): string {
  return `inline-web-search-${round}`;
}

async function executeWebSearchTool(args: Record<string, unknown>): Promise<string> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) {
    return "Fehler: leere Suchanfrage.";
  }
  const result = await runWebSearch(query);
  if (!result.ok) {
    if (result.error === "not_configured") {
      return "Web-Recherche ist nicht konfiguriert.";
    }
    return `Suche fehlgeschlagen (${result.error}${result.detail ? `: ${result.detail}` : ""}).`;
  }
  return `Suchanfrage: ${query}\nProvider: ${result.provider}\n\n${formatWebSearchHitsForLlm(result.hits)}`;
}

export async function runLlmChatWithOptionalWebSearch(
  messages: LlmChatCompletionMessage[],
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<
  | { ok: true; content: string; webSearchUsed: boolean }
  | { ok: false; error: string; detail?: string }
> {
  const webSearchEnabled = await isWebSearchConfigured();
  if (!webSearchEnabled) {
    const single = await callLlmChatCompletion(messages, options);
    if (!single.ok) return single;
    const content = single.message.content?.trim();
    if (!content) return { ok: false, error: "empty_response" };
    return { ok: true, content, webSearchUsed: false };
  }

  const transcript: LlmChatCompletionMessage[] = [...messages];
  const tools = [LLM_WEB_SEARCH_TOOL];
  let webSearchUsed = false;
  let searchCount = 0;

  for (let round = 0; round < LLM_MAX_TOOL_ROUNDS; round++) {
    const result = await callLlmChatCompletion(transcript, { ...options, tools });
    if (!result.ok) {
      if (round === 0 && result.error === "tools_not_supported") {
        const fallback = await callLlmChatCompletion(transcript, options);
        if (!fallback.ok) return fallback;
        const content = fallback.message.content?.trim();
        if (!content) return { ok: false, error: "empty_response" };
        return { ok: true, content, webSearchUsed: false };
      }
      return result;
    }

    const assistant = result.message;
    let toolCalls = assistant.tool_calls ?? [];
    const content = assistant.content?.trim() ?? "";

    if (toolCalls.length === 0) {
      const inline = parseInlineWebSearchRequest(content);
      if (inline) {
        toolCalls = [
          {
            id: syntheticToolCallId(round),
            type: "function",
            function: {
              name: LLM_WEB_SEARCH_TOOL_NAME,
              arguments: JSON.stringify({ query: inline.query }),
            },
          },
        ];
      } else if (!content) {
        return { ok: false, error: "empty_response" };
      } else {
        return { ok: true, content, webSearchUsed };
      }
    }

    transcript.push({
      role: "assistant",
      content: assistant.content ?? null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (call.function.name === LLM_WEB_SEARCH_TOOL_NAME) {
        searchCount += 1;
        webSearchUsed = true;
      }
      let output: string;
      if (call.function.name === LLM_WEB_SEARCH_TOOL_NAME) {
        if (searchCount > LLM_MAX_WEB_SEARCHES_PER_TURN) {
          output =
            "Limit erreicht: maximal 4 Web-Suchen pro Nutzerfrage. Fasse mit vorhandenen Treffern zusammen oder frage nach fehlenden Angaben.";
        } else {
          const parsed = parseWebSearchToolArgs(call.function.arguments);
          output = parsed
            ? await executeWebSearchTool({ query: parsed.query })
            : "Fehler: ungültige Suchparameter.";
        }
      } else {
        output = `Unbekanntes Tool: ${call.function.name}`;
      }
      transcript.push({
        role: "tool",
        tool_call_id: call.id,
        content: output,
      });
    }
  }

  return { ok: false, error: "max_tool_rounds" };
}
