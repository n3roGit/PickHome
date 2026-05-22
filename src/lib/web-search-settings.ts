import { getOrCreateAppSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

export const WEB_SEARCH_API_KEY_MAX_LENGTH = 500;
export type WebSearchProvider = "duckduckgo" | "tavily" | "brave";

export function parseWebSearchProvider(raw: string | undefined): WebSearchProvider {
  const value = (raw ?? process.env.PICKHOME_WEB_SEARCH_PROVIDER ?? "duckduckgo")
    .trim()
    .toLowerCase();
  if (value === "brave") return "brave";
  if (value === "tavily") return "tavily";
  return "duckduckgo";
}

export function parseWebSearchApiKeyInput(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > WEB_SEARCH_API_KEY_MAX_LENGTH) {
    throw new Error("web_search_api_key_too_long");
  }
  return trimmed;
}

export function isWebSearchGloballyDisabled(): boolean {
  return process.env.PICKHOME_WEB_SEARCH === "0";
}

export async function getWebSearchApiKey(): Promise<string | null> {
  const settings = await getOrCreateAppSettings();
  const fromDb = settings.webSearchApiKey?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env.PICKHOME_WEB_SEARCH_API_KEY?.trim();
  return fromEnv || null;
}

/** DuckDuckGo is built-in; paid providers need an API key. */
export async function getEffectiveWebSearchProvider(): Promise<WebSearchProvider> {
  const preferred = parseWebSearchProvider(process.env.PICKHOME_WEB_SEARCH_PROVIDER);
  if (preferred === "duckduckgo") return "duckduckgo";
  const apiKey = await getWebSearchApiKey();
  if (apiKey) return preferred;
  return "duckduckgo";
}

export async function isWebSearchConfigured(): Promise<boolean> {
  if (isWebSearchGloballyDisabled()) return false;
  const provider = await getEffectiveWebSearchProvider();
  if (provider === "duckduckgo") return true;
  return Boolean(await getWebSearchApiKey());
}

export async function getWebSearchClientConfig(): Promise<{
  apiKey: string;
  provider: "tavily" | "brave";
} | null> {
  const apiKey = await getWebSearchApiKey();
  if (!apiKey) return null;
  const preferred = parseWebSearchProvider(process.env.PICKHOME_WEB_SEARCH_PROVIDER);
  if (preferred === "duckduckgo") return null;
  return { apiKey, provider: preferred };
}

export async function isWebSearchApiKeyConfigured(): Promise<boolean> {
  const settings = await getOrCreateAppSettings();
  if (settings.webSearchApiKey?.trim()) return true;
  return Boolean(process.env.PICKHOME_WEB_SEARCH_API_KEY?.trim());
}
