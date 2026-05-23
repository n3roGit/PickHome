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

const WEB_SEARCH_USER_FOLLOWUP =
  "Fasse die Web-Suchergebnisse in normaler deutscher Prosa zusammen. Gib keine Tool-JSON-, kein Code- und kein URL-Schnipsel als Antwort aus.";

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

function extractSearchQueryFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    for (const key of ["q", "query", "p", "text"]) {
      const value = parsed.searchParams.get(key)?.trim();
      if (value) return value;
    }
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    if (host && path && path !== "/") {
      return `${host} ${decodeURIComponent(path.slice(1).replace(/[+/]/g, " "))}`.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

function queryFromParsedWebSearchObject(parsed: Record<string, unknown>): string | null {
  const direct = typeof parsed.query === "string" ? parsed.query.trim() : "";
  if (direct) return direct;

  const url =
    typeof parsed.url === "string"
      ? parsed.url.trim()
      : typeof parsed.href === "string"
        ? parsed.href.trim()
        : "";
  if (url) {
    const fromUrl = extractSearchQueryFromUrl(url);
    if (fromUrl) return fromUrl;
  }

  const args = parsed.arguments;
  if (typeof args === "string") {
    return parseWebSearchToolArgs(args)?.query ?? null;
  }
  if (args && typeof args === "object" && !Array.isArray(args)) {
    const nested = (args as { query?: unknown; url?: unknown }).query;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    const nestedUrl = (args as { url?: unknown }).url;
    if (typeof nestedUrl === "string" && nestedUrl.trim()) {
      return extractSearchQueryFromUrl(nestedUrl.trim());
    }
  }

  const input = parsed.input;
  if (typeof input === "string" && input.trim()) return input.trim();

  return null;
}

function isWebSearchMarker(marker: string): boolean {
  const lower = marker.toLowerCase();
  return lower === LLM_WEB_SEARCH_TOOL_NAME || lower === "web_search" || lower.includes("web_search");
}

/** Strip markdown code fences so inline JSON can be parsed. */
export function stripMarkdownCodeFences(text: string): string {
  const trimmed = text.trim();
  const fullFence = trimmed.match(/^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fullFence) return fullFence[1].trim();
  return trimmed;
}

function collectJsonObjectCandidates(text: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith("{")) candidates.add(trimmed);
  };

  add(text);
  add(stripMarkdownCodeFences(text));

  const fenceRe = /```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fenceRe.exec(text)) !== null) {
    add(fenceMatch[1]);
  }

  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          add(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  return [...candidates];
}

function parseWebSearchJsonObject(raw: string): { query: string } | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const marker = String(parsed.type ?? parsed.name ?? parsed.function ?? parsed.tool ?? "");
    if (marker && !isWebSearchMarker(marker)) return null;
    if (!marker) {
      const hasQueryField =
        typeof parsed.query === "string" ||
        typeof parsed.url === "string" ||
        typeof parsed.arguments === "object" ||
        typeof parsed.arguments === "string";
      if (!hasQueryField) return null;
    }
    const query = queryFromParsedWebSearchObject(parsed);
    return query ? { query } : null;
  } catch {
    return null;
  }
}

/** Some models emit tool intent as plain JSON in message content instead of tool_calls. */
export function parseInlineWebSearchRequest(content: string): { query: string } | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  for (const candidate of collectJsonObjectCandidates(trimmed)) {
    const parsed = parseWebSearchJsonObject(candidate);
    if (parsed) return parsed;
  }

  const quoted = trimmed.match(
    /web_search\s*[(:]\s*["']([^"']{3,})["']/i
  );
  if (quoted?.[1]) return { query: quoted[1].trim() };

  const fetchUrl = trimmed.match(/fetch\s*\(\s*["'](https?:\/\/[^"']+)["']/i);
  if (fetchUrl?.[1]) {
    const fromUrl = extractSearchQueryFromUrl(fetchUrl[1]);
    if (fromUrl) return { query: fromUrl };
  }

  return null;
}

/** True when assistant content is only a web_search payload (no real answer for the user). */
export function isWebSearchOnlyAssistantContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  const inline = parseInlineWebSearchRequest(trimmed);
  if (!inline) return false;

  const withoutFences = trimmed.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  const withoutJson = withoutFences.replace(/\{[\s\S]*\}/, " ").replace(/\s+/g, " ").trim();
  if (!withoutJson || withoutJson.length <= 40) return true;

  const lower = withoutJson.toLowerCase();
  if (
    lower.includes("web_search") ||
    lower.includes("web-suche") ||
    lower.includes("suche im web") ||
    lower.includes("ich recherchiere")
  ) {
    return withoutJson.length <= 120;
  }

  return false;
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

async function runWebSearchFromInlineContent(
  transcript: LlmChatCompletionMessage[],
  content: string,
  searchCount: number
): Promise<{ output: string; searchCount: number; webSearchUsed: boolean }> {
  const inline = parseInlineWebSearchRequest(content);
  if (!inline) {
    return { output: "", searchCount, webSearchUsed: false };
  }
  if (searchCount >= LLM_MAX_WEB_SEARCHES_PER_TURN) {
    return {
      output:
        "Limit erreicht: maximal 4 Web-Suchen pro Nutzerfrage. Fasse mit vorhandenen Treffern zusammen oder frage nach fehlenden Angaben.",
      searchCount,
      webSearchUsed: true,
    };
  }
  const output = await executeWebSearchTool({ query: inline.query });
  return { output, searchCount: searchCount + 1, webSearchUsed: true };
}

type ChatOptions = { temperature?: number; maxTokens?: number; timeoutMs?: number };

async function finalizeAssistantContent(
  transcript: LlmChatCompletionMessage[],
  content: string,
  options: ChatOptions | undefined,
  searchCount: number,
  webSearchUsed: boolean
): Promise<
  | { ok: true; content: string; webSearchUsed: boolean }
  | { ok: false; error: string }
> {
  if (!isWebSearchOnlyAssistantContent(content)) {
    return { ok: true, content, webSearchUsed };
  }

  const recovered = await runWebSearchFromInlineContent(transcript, content, searchCount);
  if (!recovered.webSearchUsed || !recovered.output) {
    return {
      ok: true,
      content:
        "Die Web-Recherche konnte nicht ausgeführt werden. Bitte formuliere die Frage ohne URL-Code erneut.",
      webSearchUsed: false,
    };
  }

  transcript.push({ role: "assistant", content });
  transcript.push({
    role: "user",
    content: `Web-Suchergebnisse:\n\n${recovered.output}\n\n${WEB_SEARCH_USER_FOLLOWUP}`,
  });

  const followUp = await callLlmChatCompletion(transcript, options);
  if (!followUp.ok) return followUp;
  const next = followUp.message.content?.trim() ?? "";
  if (!next) return { ok: false, error: "empty_response" };
  if (isWebSearchOnlyAssistantContent(next)) {
    return {
      ok: true,
      content:
        "Die Web-Recherche wurde ausgeführt, aber die Zusammenfassung ist fehlgeschlagen. Bitte stelle die Frage erneut oder formuliere sie konkreter.",
      webSearchUsed: true,
    };
  }
  return { ok: true, content: next, webSearchUsed: true };
}

async function runLlmChatWithoutNativeTools(
  messages: LlmChatCompletionMessage[],
  options?: ChatOptions
): Promise<
  | { ok: true; content: string; webSearchUsed: boolean }
  | { ok: false; error: string; detail?: string }
> {
  const transcript: LlmChatCompletionMessage[] = [...messages];
  let webSearchUsed = false;
  let searchCount = 0;

  for (let round = 0; round < LLM_MAX_TOOL_ROUNDS; round++) {
    const result = await callLlmChatCompletion(transcript, options);
    if (!result.ok) return result;

    const content = result.message.content?.trim() ?? "";
    if (!content) return { ok: false, error: "empty_response" };

    if (isWebSearchOnlyAssistantContent(content)) {
      const recovered = await runWebSearchFromInlineContent(transcript, content, searchCount);
      if (recovered.webSearchUsed && recovered.output) {
        webSearchUsed = true;
        searchCount = recovered.searchCount;
        transcript.push({ role: "assistant", content });
        transcript.push({
          role: "user",
          content: `Web-Suchergebnisse:\n\n${recovered.output}\n\n${WEB_SEARCH_USER_FOLLOWUP}`,
        });
        continue;
      }
    }

    return await finalizeAssistantContent(transcript, content, options, searchCount, webSearchUsed);
  }

  return { ok: false, error: "max_tool_rounds" };
}

export async function runLlmChatWithOptionalWebSearch(
  messages: LlmChatCompletionMessage[],
  options?: ChatOptions
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
        return runLlmChatWithoutNativeTools(transcript, options);
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
        return await finalizeAssistantContent(transcript, content, options, searchCount, webSearchUsed);
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
