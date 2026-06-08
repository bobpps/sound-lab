import { describe, expect, it } from "vitest";
import { buildTranslatePrompt, pickCheapModel } from "./translate.ts";

describe("pickCheapModel", () => {
  it("returns null for an empty list", () => {
    expect(pickCheapModel([])).toBeNull();
  });

  it("prefers an Anthropic haiku model", () => {
    expect(
      pickCheapModel([
        "claude-sonnet-4-5-20250929",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
      ]),
    ).toBe("claude-3-5-haiku-20241022");
  });

  it("prefers an OpenAI mini model", () => {
    expect(
      pickCheapModel(["gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-4o-nano"]),
    ).toBe("gpt-4o-mini");
  });

  it("falls back to the first model when no cheap hint matches", () => {
    expect(pickCheapModel(["gpt-4", "gpt-4o"])).toBe("gpt-4");
  });
});

describe("buildTranslatePrompt", () => {
  it("embeds the target locale code", () => {
    const prompt = buildTranslatePrompt("de-DE");
    expect(prompt).toContain("de-DE");
  });

  it("instructs to output only the translation", () => {
    expect(buildTranslatePrompt("en-US").toLowerCase()).toContain("only");
  });
});
