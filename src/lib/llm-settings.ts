import { APP_SETTINGS_ID, getOrCreateAppSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

export const LLM_BASE_URL_MAX_LENGTH = 500;
export const LLM_API_KEY_MAX_LENGTH = 500;
export const LLM_MODEL_MAX_LENGTH = 200;
export const LLM_SYSTEM_PROMPT_MAX_LENGTH = 8_000;
export const DEFAULT_LLM_MODEL = "gpt-4o-mini";

/** German system prompt for all LLM calls (chat + extraction). */
export const DEFAULT_LLM_SYSTEM_PROMPT = `Du bist ein Immobilienberater für die Wohnungssuche in Deutschland.
Deine Aufgabe ist es, auf Basis der bereitgestellten Unterlagen sachliche Antworten zu geben oder strukturierte Daten zu extrahieren.
Antworte auf Deutsch, klar und knapp.
Nutze ausschließlich Informationen, die in den mitgelieferten Quellen eindeutig stehen.
Fehlende, widersprüchliche oder unklare Angaben benennst du offen — ohne Schätzen, Raten oder Ergänzen aus Allgemeinwissen.
Nenne Zahlen (Preis, Hausgeld, Fläche, Energieklasse usw.) nur, wenn sie in den Quellen vorkommen.`;

export type LlmSettingsPublic = {
  baseUrl: string | null;
  apiKeyConfigured: boolean;
  model: string | null;
  systemPrompt: string;
  systemPromptIsDefault: boolean;
  defaultSystemPrompt: string;
};

export type LlmClientConfig = {
  baseUrl: string;
  apiKey: string;
};

/** Strips provider prefixes that some relays omit from `/models` ids (e.g. `modelrelay/auto-fastest` → `auto-fastest`). */
export function normalizeLlmModelId(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return DEFAULT_LLM_MODEL;
  return trimmed.replace(/^modelrelay\//i, "");
}

export function normalizeLlmBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function parseLlmBaseUrlInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = normalizeLlmBaseUrl(trimmed);
  if (normalized.length > LLM_BASE_URL_MAX_LENGTH) {
    throw new Error("base_url_too_long");
  }
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("invalid_base_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_base_url");
  }
  return normalized;
}

export function parseLlmApiKeyInput(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > LLM_API_KEY_MAX_LENGTH) {
    throw new Error("api_key_too_long");
  }
  return trimmed;
}

export function parseLlmModelInput(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > LLM_MODEL_MAX_LENGTH) {
    throw new Error("model_too_long");
  }
  return normalizeLlmModelId(trimmed);
}

function normalizePromptText(text: string): string {
  return text.trim().replace(/\r\n/g, "\n");
}

export function isDefaultLlmSystemPrompt(text: string): boolean {
  return normalizePromptText(text) === normalizePromptText(DEFAULT_LLM_SYSTEM_PROMPT);
}

export function resolveLlmSystemPromptFromDb(dbPrompt: string | null | undefined): string {
  const custom = dbPrompt?.trim();
  if (custom) return custom;
  return DEFAULT_LLM_SYSTEM_PROMPT;
}

export function parseLlmSystemPromptInput(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  const trimmed = normalizePromptText(raw);
  if (!trimmed) return null;
  if (trimmed.length > LLM_SYSTEM_PROMPT_MAX_LENGTH) {
    throw new Error("system_prompt_too_long");
  }
  if (isDefaultLlmSystemPrompt(trimmed)) return null;
  return trimmed;
}

export async function resolveLlmSystemPrompt(): Promise<string> {
  const settings = await getOrCreateAppSettings();
  return resolveLlmSystemPromptFromDb(settings.llmSystemPrompt);
}

export async function getLlmSettingsPublic(): Promise<LlmSettingsPublic> {
  const settings = await getOrCreateAppSettings();
  const baseUrl = settings.llmBaseUrl?.trim() || null;
  const apiKeyConfigured = Boolean(settings.llmApiKey?.trim());
  const model = settings.llmModel?.trim() || null;
  const storedPrompt = settings.llmSystemPrompt?.trim() || null;
  const systemPromptIsDefault = !storedPrompt;
  return {
    baseUrl,
    apiKeyConfigured,
    model,
    systemPrompt: storedPrompt ?? DEFAULT_LLM_SYSTEM_PROMPT,
    systemPromptIsDefault,
    defaultSystemPrompt: DEFAULT_LLM_SYSTEM_PROMPT,
  };
}

export async function getLlmClientConfig(): Promise<LlmClientConfig | null> {
  const settings = await getOrCreateAppSettings();
  const baseUrl = settings.llmBaseUrl?.trim();
  const apiKey = settings.llmApiKey?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: normalizeLlmBaseUrl(baseUrl), apiKey };
}

export function resolveLlmModelFromSources(
  dbModel: string | null | undefined,
  envModel: string | null | undefined
): string {
  const fromDb = dbModel?.trim();
  if (fromDb) return normalizeLlmModelId(fromDb);
  return normalizeLlmModelId(envModel || DEFAULT_LLM_MODEL);
}

/** DB model wins; else `PICKHOME_LLM_MODEL`; else default. */
export async function resolveLlmModel(): Promise<string> {
  const settings = await getOrCreateAppSettings();
  return resolveLlmModelFromSources(settings.llmModel, process.env.PICKHOME_LLM_MODEL);
}

export async function updateLlmSettings(input: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
}): Promise<LlmSettingsPublic> {
  const data: {
    llmBaseUrl?: string | null;
    llmApiKey?: string | null;
    llmModel?: string | null;
    llmSystemPrompt?: string | null;
  } = {};

  if (input.baseUrl !== undefined) {
    data.llmBaseUrl = parseLlmBaseUrlInput(input.baseUrl);
  }

  if (input.apiKey !== undefined) {
    data.llmApiKey = parseLlmApiKeyInput(input.apiKey) ?? null;
  }

  if (input.model !== undefined) {
    data.llmModel = parseLlmModelInput(input.model) ?? null;
  }

  if (input.systemPrompt !== undefined) {
    data.llmSystemPrompt = parseLlmSystemPromptInput(input.systemPrompt) ?? null;
  }

  if (Object.keys(data).length === 0) {
    return getLlmSettingsPublic();
  }

  await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: { id: APP_SETTINGS_ID, ...data },
    update: data,
  });

  return getLlmSettingsPublic();
}
