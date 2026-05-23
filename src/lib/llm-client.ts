import {
  getLlmClientConfig,
  normalizeLlmModelId,
  resolveLlmModel,
  type LlmClientConfig,
} from "@/lib/llm-settings";

export { normalizeLlmModelId, resolveLlmModel } from "@/lib/llm-settings";

export type LlmConnectionTestResult =
  | { ok: true }
  | { ok: false; error: string; detail?: string };

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type LlmChatCompletionMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      reasoning?: string | null;
      tool_calls?: LlmChatToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type LlmChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type LlmAssistantMessage = {
  content: string | null;
  reasoning?: string | null;
  tool_calls?: LlmChatToolCall[];
};

export type LlmChatResult =
  | { ok: true; content: string }
  | { ok: false; error: string; detail?: string };

export type LlmChatCompletionResult =
  | { ok: true; message: LlmAssistantMessage }
  | { ok: false; error: string; detail?: string };

const DEFAULT_CHAT_TIMEOUT_MS = 60_000;
const AGENT_CHAT_TIMEOUT_MS = 180_000;

/** True when assistant text looks like leaked chain-of-thought, not a user answer. */
export function looksLikeReasoningLeak(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 350) return false;
  return (
    /^(Der Nutzer|Ich muss|Aus den Bewertungskriterien|Schauen wir)/i.test(trimmed) ||
    (/\bDer Nutzer fragt\b/i.test(trimmed) && /\bVielleicht\b/i.test(trimmed))
  );
}

export function looksLikeSystemPromptEcho(text: string): boolean {
  const trimmed = text.trim();
  return /^Du bist ein Immobilienberater für die Wohnungssuche in Deutschland/i.test(trimmed);
}

export function isUserFacingAssistantText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return !looksLikeReasoningLeak(trimmed) && !looksLikeSystemPromptEcho(trimmed);
}

function serializeMessagesForApi(messages: LlmChatCompletionMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === "assistant") {
      const payload: Record<string, unknown> = { role: "assistant" };
      if (message.content != null) payload.content = message.content;
      if (message.reasoning?.trim()) payload.reasoning = message.reasoning.trim();
      if (message.tool_calls?.length) payload.tool_calls = message.tool_calls;
      return payload;
    }
    return message;
  });
}

export async function isLlmConfigured(): Promise<boolean> {
  const config = await getLlmClientConfig();
  return config != null;
}

export function llmModelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/models`;
}

export function llmChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function toolsUnsupportedDetail(detail: string): boolean {
  const lower = detail.toLowerCase();
  return (
    lower.includes("tools") ||
    lower.includes("tool_choice") ||
    lower.includes("function") ||
    lower.includes("unsupported")
  );
}

export async function callLlmChatCompletion(
  messages: LlmChatCompletionMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    tools?: LlmChatTool[];
  }
): Promise<LlmChatCompletionResult> {
  const config = await getLlmClientConfig();
  if (!config) {
    return { ok: false, error: "not_configured" };
  }

  const url = llmChatCompletionsUrl(config.baseUrl);
  const model = await resolveLlmModel();
  const body: Record<string, unknown> = {
    model,
    messages: serializeMessagesForApi(messages),
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens ?? 2048,
  };
  if (options?.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(
        options?.timeoutMs ?? (options?.tools?.length ? AGENT_CHAT_TIMEOUT_MS : DEFAULT_CHAT_TIMEOUT_MS)
      ),
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "");
      let detail = rawBody.slice(0, 300);
      try {
        const parsed = JSON.parse(rawBody) as { error?: { message?: string } };
        if (parsed.error?.message) detail = parsed.error.message;
      } catch {
        /* keep raw slice */
      }
      if (options?.tools?.length && toolsUnsupportedDetail(detail)) {
        return { ok: false, error: "tools_not_supported", detail };
      }
      return { ok: false, error: "request_failed", detail };
    }

    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          reasoning?: string | null;
          tool_calls?: LlmChatToolCall[];
        };
      }[];
    };
    const message = data.choices?.[0]?.message;
    if (!message) {
      return { ok: false, error: "empty_response" };
    }
    const toolCalls = message.tool_calls?.length ? message.tool_calls : undefined;
    const content = message.content?.trim() || null;
    const reasoning = message.reasoning?.trim() || null;
    if (!content && !reasoning && !toolCalls?.length) {
      return { ok: false, error: "empty_response" };
    }
    return { ok: true, message: { content, reasoning, tool_calls: toolCalls } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, error: message };
  }
}

export async function callLlmChat(
  messages: LlmChatMessage[],
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<LlmChatResult> {
  const result = await callLlmChatCompletion(messages, options);
  if (!result.ok) return result;
  const content = result.message.content?.trim();
  if (!content) {
    return { ok: false, error: "empty_response" };
  }
  return { ok: true, content };
}

export async function testLlmConnectionWithConfig(
  config: LlmClientConfig
): Promise<LlmConnectionTestResult> {
  const url = llmModelsUrl(config.baseUrl);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: "request_failed",
        detail: body.slice(0, 200) || res.statusText,
      };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, error: "fetch_failed", detail: message };
  }
}

export async function testLlmConnection(): Promise<LlmConnectionTestResult> {
  const config = await getLlmClientConfig();
  if (!config) {
    return { ok: false, error: "not_configured" };
  }
  return testLlmConnectionWithConfig(config);
}
