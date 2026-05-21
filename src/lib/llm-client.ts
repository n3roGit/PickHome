import {
  getLlmClientConfig,
  normalizeLlmModelId,
  resolveLlmModel,
} from "@/lib/llm-settings";

export { normalizeLlmModelId, resolveLlmModel } from "@/lib/llm-settings";

export type LlmConnectionTestResult =
  | { ok: true }
  | { ok: false; error: string; detail?: string };

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatResult =
  | { ok: true; content: string }
  | { ok: false; error: string; detail?: string };

const DEFAULT_CHAT_TIMEOUT_MS = 60_000;

function extractAssistantContent(
  message?: { content?: string | null; reasoning?: string | null } | null
): string | undefined {
  if (!message) return undefined;
  const content = message.content?.trim();
  if (content) return content;
  const reasoning = message?.reasoning?.trim();
  return reasoning || undefined;
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

export async function callLlmChat(
  messages: LlmChatMessage[],
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<LlmChatResult> {
  const config = await getLlmClientConfig();
  if (!config) {
    return { ok: false, error: "not_configured" };
  }

  const url = llmChatCompletionsUrl(config.baseUrl);
  const model = await resolveLlmModel();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 2048,
      }),
      signal: AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let detail = body.slice(0, 300);
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        if (parsed.error?.message) detail = parsed.error.message;
      } catch {
        /* keep raw slice */
      }
      return { ok: false, error: "request_failed", detail };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning?: string } }[];
    };
    const content = extractAssistantContent(data.choices?.[0]?.message);
    if (!content) {
      return { ok: false, error: "empty_response" };
    }
    return { ok: true, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, error: message };
  }
}

export async function testLlmConnection(): Promise<LlmConnectionTestResult> {
  const config = await getLlmClientConfig();
  if (!config) {
    return { ok: false, error: "not_configured" };
  }

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
