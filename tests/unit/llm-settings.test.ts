import { describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_SYSTEM_PROMPT,
  isDefaultLlmSystemPrompt,
  normalizeLlmBaseUrl,
  normalizeLlmModelId,
  parseLlmApiKeyInput,
  parseLlmBaseUrlInput,
  parseLlmModelInput,
  parseLlmSystemPromptInput,
  resolveLlmModelFromSources,
  resolveLlmSystemPromptFromDb,
} from "@/lib/llm-settings";

describe("normalizeLlmBaseUrl", () => {
  it("trims and removes trailing slashes", () => {
    expect(normalizeLlmBaseUrl("  https://api.example.com/v1/  ")).toBe(
      "https://api.example.com/v1"
    );
  });
});

describe("parseLlmBaseUrlInput", () => {
  it("accepts http and https URLs", () => {
    expect(parseLlmBaseUrlInput("http://localhost:11434/v1")).toBe("http://localhost:11434/v1");
    expect(parseLlmBaseUrlInput("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
  });

  it("returns null for empty input", () => {
    expect(parseLlmBaseUrlInput("")).toBeNull();
    expect(parseLlmBaseUrlInput("   ")).toBeNull();
  });

  it("rejects invalid protocols and malformed URLs", () => {
    expect(() => parseLlmBaseUrlInput("ftp://example.com/v1")).toThrow("invalid_base_url");
    expect(() => parseLlmBaseUrlInput("not-a-url")).toThrow("invalid_base_url");
  });
});

describe("normalizeLlmModelId", () => {
  it("strips modelrelay prefix", () => {
    expect(normalizeLlmModelId("modelrelay/auto-fastest")).toBe("auto-fastest");
  });
});

describe("parseLlmModelInput", () => {
  it("returns null for empty string", () => {
    expect(parseLlmModelInput("")).toBeNull();
  });

  it("normalizes on save", () => {
    expect(parseLlmModelInput("  modelrelay/auto-fastest ")).toBe("auto-fastest");
  });
});

describe("resolveLlmModelFromSources", () => {
  it("prefers database over env", () => {
    expect(resolveLlmModelFromSources("gpt-4o", "auto-fastest")).toBe("gpt-4o");
  });

  it("uses env when db empty", () => {
    expect(resolveLlmModelFromSources(null, "modelrelay/auto-fastest")).toBe("auto-fastest");
  });
});

describe("resolveLlmSystemPromptFromDb", () => {
  it("uses default when db empty", () => {
    expect(resolveLlmSystemPromptFromDb(null)).toBe(DEFAULT_LLM_SYSTEM_PROMPT);
    expect(resolveLlmSystemPromptFromDb("  ")).toBe(DEFAULT_LLM_SYSTEM_PROMPT);
  });

  it("uses custom prompt from db", () => {
    expect(resolveLlmSystemPromptFromDb("Custom advisor")).toBe("Custom advisor");
  });
});

describe("parseLlmSystemPromptInput", () => {
  it("stores null for empty or default text", () => {
    expect(parseLlmSystemPromptInput("")).toBeNull();
    expect(parseLlmSystemPromptInput(DEFAULT_LLM_SYSTEM_PROMPT)).toBeNull();
  });

  it("stores trimmed custom prompt", () => {
    expect(parseLlmSystemPromptInput("  Eigener Prompt  ")).toBe("Eigener Prompt");
  });

  it("rejects prompts that are too long", () => {
    expect(() => parseLlmSystemPromptInput("x".repeat(8_001))).toThrow("system_prompt_too_long");
  });
});

describe("isDefaultLlmSystemPrompt", () => {
  it("matches default with normalized line endings", () => {
    expect(isDefaultLlmSystemPrompt(DEFAULT_LLM_SYSTEM_PROMPT.replace(/\n/g, "\r\n"))).toBe(true);
    expect(isDefaultLlmSystemPrompt("Anders")).toBe(false);
  });
});

describe("parseLlmApiKeyInput", () => {
  it("returns undefined when omitted", () => {
    expect(parseLlmApiKeyInput(undefined)).toBeUndefined();
  });

  it("returns null for empty string (clear token)", () => {
    expect(parseLlmApiKeyInput("")).toBeNull();
    expect(parseLlmApiKeyInput("   ")).toBeNull();
  });

  it("returns trimmed token", () => {
    expect(parseLlmApiKeyInput("  sk-test  ")).toBe("sk-test");
  });
});
