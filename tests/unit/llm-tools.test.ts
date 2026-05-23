import { describe, expect, it } from "vitest";
import {
  isWebSearchOnlyAssistantContent,
  parseInlineWebSearchRequest,
  parseWebSearchToolArgs,
  stripMarkdownCodeFences,
} from "@/lib/llm-tools";

describe("parseWebSearchToolArgs", () => {
  it("parses valid query", () => {
    expect(parseWebSearchToolArgs('{"query":"Sanierungskosten Altbau Berlin"}')).toEqual({
      query: "Sanierungskosten Altbau Berlin",
    });
  });

  it("rejects empty query", () => {
    expect(parseWebSearchToolArgs('{"query":"   "}')).toBeNull();
    expect(parseWebSearchToolArgs("{}")).toBeNull();
    expect(parseWebSearchToolArgs("not json")).toBeNull();
  });
});

describe("parseInlineWebSearchRequest", () => {
  it("parses type web_search JSON from assistant content", () => {
    expect(
      parseInlineWebSearchRequest(
        '{"type":"web_search","query":"Stuhr Brinkum Stadtteil Bewertung"}'
      )
    ).toEqual({ query: "Stuhr Brinkum Stadtteil Bewertung" });
  });

  it("parses function-style payload", () => {
    expect(
      parseInlineWebSearchRequest(
        '{"function":"web_search","arguments":{"query":"München Mietpreise"}}'
      )
    ).toEqual({ query: "München Mietpreise" });
  });

  it("rejects normal prose", () => {
    expect(parseInlineWebSearchRequest("Der Stadtteil wirkt ruhig.")).toBeNull();
  });

  it("parses fenced JSON", () => {
    expect(
      parseInlineWebSearchRequest(
        '```json\n{"type":"web_search","query":"Sanierungskosten Altbau"}\n```'
      )
    ).toEqual({ query: "Sanierungskosten Altbau" });
  });

  it("extracts query from search URL", () => {
    expect(
      parseInlineWebSearchRequest(
        '{"type":"web_search","url":"https://duckduckgo.com/?q=M%C3%BCnchen+Mietpreise"}'
      )
    ).toEqual({ query: "München Mietpreise" });
  });

  it("parses fetch() URL snippet", () => {
    expect(
      parseInlineWebSearchRequest(
        'fetch("https://duckduckgo.com/?q=Heizkosten+Gas+2024")'
      )
    ).toEqual({ query: "Heizkosten Gas 2024" });
  });

  it("parses web_search() call syntax", () => {
    expect(parseInlineWebSearchRequest('web_search("Stadtteil Bewertung")')).toEqual({
      query: "Stadtteil Bewertung",
    });
  });
});

describe("stripMarkdownCodeFences", () => {
  it("removes json code fence", () => {
    expect(stripMarkdownCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe("isWebSearchOnlyAssistantContent", () => {
  it("detects raw tool JSON", () => {
    expect(
      isWebSearchOnlyAssistantContent('{"type":"web_search","query":"Mietpreise Berlin"}')
    ).toBe(true);
  });

  it("allows normal answers", () => {
    expect(
      isWebSearchOnlyAssistantContent(
        "Laut Exposé beträgt das Hausgeld 320 Euro monatlich."
      )
    ).toBe(false);
  });
});
