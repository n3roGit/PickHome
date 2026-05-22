import { describe, expect, it } from "vitest";
import { formatWebSearchHitsForLlm } from "@/lib/web-search";
import { parseWebSearchProvider } from "@/lib/web-search-settings";

describe("formatWebSearchHitsForLlm", () => {
  it("returns no hits message when empty", () => {
    expect(formatWebSearchHitsForLlm([])).toBe("Keine Treffer.");
  });

  it("formats hits with title, url and snippet", () => {
    const text = formatWebSearchHitsForLlm([
      { title: "Sanierung Kosten", url: "https://example.com/a", snippet: "ca. 500 €/m²" },
    ]);
    expect(text).toContain("[1] Sanierung Kosten");
    expect(text).toContain("https://example.com/a");
    expect(text).toContain("500 €/m²");
  });
});

describe("parseWebSearchProvider", () => {
  it("defaults to tavily", () => {
    expect(parseWebSearchProvider(undefined)).toBe("tavily");
  });

  it("accepts brave", () => {
    expect(parseWebSearchProvider("brave")).toBe("brave");
  });
});
