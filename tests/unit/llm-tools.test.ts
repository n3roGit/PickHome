import { describe, expect, it } from "vitest";
import { parseInlineWebSearchRequest, parseWebSearchToolArgs } from "@/lib/llm-tools";

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
});
