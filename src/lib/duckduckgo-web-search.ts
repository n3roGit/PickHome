import type { WebSearchHit } from "@/lib/web-search";

export const DUCKDUCKGO_SEARCH_MIN_INTERVAL_MS = 1100;
export const DUCKDUCKGO_HTML_SEARCH_URL = "https://html.duckduckgo.com/html/";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; PickHome/1.0; +https://github.com/n3roGit/PickHome)";

let nextSearchAllowedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSearchSlot(): Promise<void> {
  const now = Date.now();
  if (now < nextSearchAllowedAt) {
    await sleep(nextSearchAllowedAt - now);
  }
  nextSearchAllowedAt = Date.now() + DUCKDUCKGO_SEARCH_MIN_INTERVAL_MS;
}

/** Unwrap DuckDuckGo redirect links (//duckduckgo.com/l/?uddg=…). */
export function unwrapDuckDuckGoResultUrl(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  try {
    const absolute = trimmed.startsWith("//")
      ? `https:${trimmed}`
      : trimmed.startsWith("/")
        ? `https://duckduckgo.com${trimmed}`
        : trimmed;
    const parsed = new URL(absolute);
    if (parsed.hostname.endsWith("duckduckgo.com") && parsed.pathname.startsWith("/l/")) {
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) return decodeURIComponent(uddg);
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

/**
 * Parse DuckDuckGo HTML results (html.duckduckgo.com).
 * Based on the public HTML layout used by duckduckgo-mcp-server and similar tools.
 */
export function parseDuckDuckGoHtmlResults(html: string, maxResults: number): WebSearchHit[] {
  const hits: WebSearchHit[] = [];
  const seenUrls = new Set<string>();
  const linkRe =
    /<a[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let link: RegExpExecArray | null;
  while ((link = linkRe.exec(html)) !== null && hits.length < maxResults) {
    const url = unwrapDuckDuckGoResultUrl(link[1]);
    const title = stripTags(link[2]);
    if (!url || !title || seenUrls.has(url)) continue;
    seenUrls.add(url);

    const after = html.slice(link.index, link.index + 1200);
    const snippetMatch = after.match(
      /<a[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i
    );
    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : title;

    hits.push({ title, url, snippet });
  }

  return hits;
}

export type DuckDuckGoSearchResult =
  | { ok: true; hits: WebSearchHit[] }
  | { ok: false; error: string; detail?: string };

export async function searchDuckDuckGoWeb(
  query: string,
  options?: { maxResults?: number; region?: string }
): Promise<DuckDuckGoSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: "empty_query" };
  }

  await waitForSearchSlot();

  const maxResults = options?.maxResults ?? 5;
  const region = options?.region ?? process.env.PICKHOME_WEB_SEARCH_REGION ?? "de-de";
  const url = new URL(DUCKDUCKGO_HTML_SEARCH_URL);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("kl", region);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: "request_failed", detail: body.slice(0, 200) };
    }
    const html = await res.text();
    const hits = parseDuckDuckGoHtmlResults(html, maxResults);
    if (hits.length === 0) {
      return { ok: false, error: "no_results", detail: "html_parse_empty" };
    }
    return { ok: true, hits };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, error: message };
  }
}
