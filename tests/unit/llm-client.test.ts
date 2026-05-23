import { describe, expect, it } from "vitest";
import {
  isUserFacingAssistantText,
  llmModelsUrl,
  looksLikeReasoningLeak,
  looksLikeSystemPromptEcho,
} from "@/lib/llm-client";

describe("llmModelsUrl", () => {
  it("appends /models to normalized base", () => {
    expect(llmModelsUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1/models");
    expect(llmModelsUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1/models");
  });
});

describe("looksLikeReasoningLeak", () => {
  it("detects long internal reasoning text", () => {
    const leak =
      "Der Nutzer fragt nach den drei schlechtesten bewerteten Kriterien. Ich muss die Bewertungskriterien aus den bereitgestellten Daten analysieren. ".repeat(
        8
      );
    expect(looksLikeReasoningLeak(leak)).toBe(true);
  });

  it("allows short user-facing answers", () => {
    expect(
      looksLikeReasoningLeak(
        "Deine drei schlechtesten Kriterien: Garage (1/10), Sicherheit FI (2/10), Fenster (2/10)."
      )
    ).toBe(false);
  });
});

describe("looksLikeSystemPromptEcho", () => {
  it("detects echoed default system prompt", () => {
    expect(
      looksLikeSystemPromptEcho(
        "Du bist ein Immobilienberater für die Wohnungssuche in Deutschland. Deine Aufgabe ist es..."
      )
    ).toBe(true);
  });
});

describe("isUserFacingAssistantText", () => {
  it("accepts normal answers", () => {
    expect(isUserFacingAssistantText("Garage, Fenster, Sicherheit (FI)")).toBe(true);
  });
});
