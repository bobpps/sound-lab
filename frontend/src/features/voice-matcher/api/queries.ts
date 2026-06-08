import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type { Voice } from "../../../types/api.ts";

export const REFERENCE_PROVIDER_ID = "gemini-tts";
export const CANDIDATE_PROVIDER_ID = "google";
export const STANDARD_MODEL = "Standard";

export const voiceMatcherKeys = {
  standardVoices: () =>
    ["voice-matcher", "voices", CANDIDATE_PROVIDER_ID, STANDARD_MODEL] as const,
  geminiVoices: (model: string) =>
    ["voice-matcher", "voices", REFERENCE_PROVIDER_ID, model] as const,
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
