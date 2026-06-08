// Hints that mark a provider's cheaper / faster tier. Translation is a light
// task, so we prefer one of these over the flagship model when available.
const CHEAP_MODEL_HINTS = ["haiku", "mini", "nano", "flash", "lite", "small"];

/**
 * Pick the cheapest / fastest model from a provider's model list. Falls back to
 * the first model when none of the cheap hints match. Returns null for an empty
 * list (provider models not loaded yet).
 */
export function pickCheapModel(models: string[]): string | null {
  if (models.length === 0) {
    return null;
  }
  const cheap = models.find((model) =>
    CHEAP_MODEL_HINTS.some((hint) => model.toLowerCase().includes(hint)),
  );
  return cheap ?? models[0];
}

/** System prompt instructing the LLM to translate into the given BCP-47 locale. */
export function buildTranslatePrompt(locale: string): string {
  return [
    "You are a translation engine.",
    `Translate the user's text into the language identified by the BCP-47 locale code "${locale}".`,
    "Preserve the meaning, tone, and punctuation.",
    "Output ONLY the translated text — no quotes, no explanations, no extra commentary.",
  ].join(" ");
}
