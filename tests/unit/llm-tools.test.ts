import { describe, expect, it } from "vitest";
import { parseWebSearchToolArgs } from "@/lib/llm-tools";

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
