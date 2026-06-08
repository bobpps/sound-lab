import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type { Provider, Voice } from "../../../types/api.ts";
import { buildTranslatePrompt } from "../lib/translate.ts";

export const REFERENCE_PROVIDER_ID = "gemini-tts";
export const CANDIDATE_PROVIDER_ID = "google";
export const STANDARD_MODEL = "Standard";

// Every reference voice is supported by every model, so the synthesis fans the
// chosen voice out across all three models. The voice list is loaded from the
// default model only — the others return the same set.
export const REFERENCE_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-3.1-flash-tts-preview",
] as const;

export const DEFAULT_REFERENCE_MODEL: string = REFERENCE_MODELS[0];

export const voiceMatcherKeys = {
  standardVoices: () =>
    ["voice-matcher", "voices", CANDIDATE_PROVIDER_ID, STANDARD_MODEL] as const,
  geminiVoices: (model: string) =>
    ["voice-matcher", "voices", REFERENCE_PROVIDER_ID, model] as const,
  llmProviders: () => ["voice-matcher", "llm-providers"] as const,
  llmModels: (providerId: string) =>
    ["voice-matcher", "llm-models", providerId] as const,
};

export function useStandardVoices() {
  return useQuery({
    queryKey: voiceMatcherKeys.standardVoices(),
    queryFn: () =>
      api.get<Voice[]>(
        `/tts/${CANDIDATE_PROVIDER_ID}/voices?model=${encodeURIComponent(STANDARD_MODEL)}`,
      ),
  });
}

export function useGeminiVoices(model: string | null) {
  return useQuery({
    queryKey: voiceMatcherKeys.geminiVoices(model ?? ""),
    queryFn: () =>
      api.get<Voice[]>(
        `/tts/${REFERENCE_PROVIDER_ID}/voices?model=${encodeURIComponent(model ?? "")}`,
      ),
    enabled: model !== null,
  });
}

export function useLlmProviders() {
  return useQuery({
    queryKey: voiceMatcherKeys.llmProviders(),
    queryFn: () => api.get<Provider[]>("/providers?type=llm"),
  });
}

export function useLlmModels(providerId: string | null) {
  return useQuery({
    queryKey: voiceMatcherKeys.llmModels(providerId ?? ""),
    queryFn: () => api.get<string[]>(`/llm/${providerId}/models`),
    enabled: providerId !== null,
  });
}

export interface TranslateInput {
  providerId: string;
  model: string;
  text: string;
  locale: string;
}

export function useTranslate() {
  return useMutation({
    mutationFn: ({ providerId, model, text, locale }: TranslateInput) =>
      api.post<{ text: string }>(`/llm/${providerId}/complete`, {
        model,
        messages: [
          { role: "system", content: buildTranslatePrompt(locale) },
          { role: "user", content: text },
        ],
      }),
  });
}
