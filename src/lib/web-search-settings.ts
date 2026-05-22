import { getOrCreateAppSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

export const WEB_SEARCH_API_KEY_MAX_LENGTH = 500;
export type WebSearchProvider = "tavily" | "brave";

export function parseWebSearchProvider(raw: string | undefined): WebSearchProvider {
  const value = (raw ?? process.env.PICKHOME_WEB_SEARCH_PROVIDER ?? "tavily").trim().toLowerCase();
  if (value === "brave") return "brave";
  return "tavily";
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

export async function getWebSearchApiKey(): Promise<string | null> {
  const settings = await getOrCreateAppSettings();
  const fromDb = settings.webSearchApiKey?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env.PICKHOME_WEB_SEARCH_API_KEY?.trim();
  return fromEnv || null;
}

export async function isWebSearchConfigured(): Promise<boolean> {
  return Boolean(await getWebSearchApiKey());
}

export async function getWebSearchClientConfig(): Promise<{
  apiKey: string;
  provider: WebSearchProvider;
} | null> {
  const apiKey = await getWebSearchApiKey();
  if (!apiKey) return null;
  return { apiKey, provider: parseWebSearchProvider(process.env.PICKHOME_WEB_SEARCH_PROVIDER) };
}

export async function isWebSearchApiKeyConfigured(): Promise<boolean> {
  const settings = await getOrCreateAppSettings();
  if (settings.webSearchApiKey?.trim()) return true;
  return Boolean(process.env.PICKHOME_WEB_SEARCH_API_KEY?.trim());
}
