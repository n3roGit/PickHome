import { searchDuckDuckGoWeb } from "@/lib/duckduckgo-web-search";
import {
  getEffectiveWebSearchProvider,
  getWebSearchClientConfig,
  isWebSearchGloballyDisabled,
  type WebSearchProvider,
} from "@/lib/web-search-settings";

export const WEB_SEARCH_MAX_RESULTS = 5;
export const WEB_SEARCH_SNIPPET_MAX_CHARS = 900;

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResult =
  | { ok: true; hits: WebSearchHit[]; provider: WebSearchProvider }
  | { ok: false; error: string; detail?: string };

function truncateSnippet(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= WEB_SEARCH_SNIPPET_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, WEB_SEARCH_SNIPPET_MAX_CHARS)}…`;
}

export function formatWebSearchHitsForLlm(hits: WebSearchHit[]): string {
  if (hits.length === 0) {
    return "Keine Treffer.";
  }
  return hits
    .map(
      (hit, index) =>
        `[${index + 1}] ${hit.title}\nURL: ${hit.url}\n${hit.snippet}`
    )
    .join("\n\n");
}

async function searchTavily(apiKey: string, query: string): Promise<WebSearchResult> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: WEB_SEARCH_MAX_RESULTS,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: "request_failed", detail: body.slice(0, 200) };
    }
    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    const hits: WebSearchHit[] = (data.results ?? [])
      .map((row) => ({
        title: row.title?.trim() || "Ohne Titel",
        url: row.url?.trim() || "",
        snippet: truncateSnippet(row.content ?? ""),
      }))
      .filter((h) => h.url && h.snippet);
    return { ok: true, hits, provider: "tavily" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, error: message };
  }
}

async function searchBrave(apiKey: string, query: string): Promise<WebSearchResult> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(WEB_SEARCH_MAX_RESULTS));
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: "request_failed", detail: body.slice(0, 200) };
    }
    const data = (await res.json()) as {
      web?: { results?: { title?: string; url?: string; description?: string }[] };
    };
    const hits: WebSearchHit[] = (data.web?.results ?? [])
      .map((row) => ({
        title: row.title?.trim() || "Ohne Titel",
        url: row.url?.trim() || "",
        snippet: truncateSnippet(row.description ?? ""),
      }))
      .filter((h) => h.url && h.snippet);
    return { ok: true, hits, provider: "brave" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, error: message };
  }
}

async function searchDuckDuckGo(query: string): Promise<WebSearchResult> {
  const result = await searchDuckDuckGoWeb(query, { maxResults: WEB_SEARCH_MAX_RESULTS });
  if (!result.ok) {
    return result;
  }
  const hits = result.hits.map((hit) => ({
    ...hit,
    snippet: truncateSnippet(hit.snippet),
  }));
  return { ok: true, hits, provider: "duckduckgo" };
}

export async function runWebSearch(query: string): Promise<WebSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: "empty_query" };
  }
  if (isWebSearchGloballyDisabled()) {
    return { ok: false, error: "not_configured" };
  }

  const provider = await getEffectiveWebSearchProvider();
  if (provider === "duckduckgo") {
    return searchDuckDuckGo(trimmed);
  }

  const config = await getWebSearchClientConfig();
  if (!config) {
    return searchDuckDuckGo(trimmed);
  }
  if (config.provider === "brave") {
    const paid = await searchBrave(config.apiKey, trimmed);
    if (paid.ok) return paid;
    const fallback = await searchDuckDuckGo(trimmed);
    if (fallback.ok) return fallback;
    return paid;
  }

  const paid = await searchTavily(config.apiKey, trimmed);
  if (paid.ok) return paid;
  const fallback = await searchDuckDuckGo(trimmed);
  if (fallback.ok) return fallback;
  return paid;
}
