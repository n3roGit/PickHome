import { describe, expect, it } from "vitest";
import { llmModelsUrl } from "@/lib/llm-client";

describe("llmModelsUrl", () => {
  it("appends /models to normalized base", () => {
    expect(llmModelsUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1/models");
    expect(llmModelsUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1/models");
  });
});
