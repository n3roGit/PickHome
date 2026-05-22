import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseDuckDuckGoHtmlResults,
  unwrapDuckDuckGoResultUrl,
} from "@/lib/duckduckgo-web-search";

const fixtureHtml = readFileSync(
  join(process.cwd(), "tests/fixtures/duckduckgo-html-sample.html"),
  "utf8"
);

describe("unwrapDuckDuckGoResultUrl", () => {
  it("decodes duckduckgo redirect uddg parameter", () => {
    const href =
      "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fcosts&rut=abc";
    expect(unwrapDuckDuckGoResultUrl(href)).toBe("https://example.com/costs");
  });

  it("returns direct https links unchanged", () => {
    expect(unwrapDuckDuckGoResultUrl("https://example.org/guide")).toBe(
      "https://example.org/guide"
    );
  });
});

describe("parseDuckDuckGoHtmlResults", () => {
  it("parses titles, urls and snippets from html fixture", () => {
    const hits = parseDuckDuckGoHtmlResults(fixtureHtml, 5);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({
      title: "Sanierungskosten Orientierung",
      url: "https://example.com/costs",
      snippet: "Typische Kosten liegen bei 400 bis 800 Euro pro Quadratmeter.",
    });
    expect(hits[1].url).toBe("https://example.org/guide");
    expect(hits[1].title).toBe("Renovation guide");
  });

  it("respects maxResults", () => {
    const hits = parseDuckDuckGoHtmlResults(fixtureHtml, 1);
    expect(hits).toHaveLength(1);
  });
});
