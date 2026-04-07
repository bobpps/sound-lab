import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type {
  AnnotatedDialog,
  Dialog,
  Provider,
  Voice,
} from "../../../types/api.ts";

export const ttsKeys = {
  providers: () => ["tts", "providers"] as const,
  voices: (providerId: string) => ["tts", "voices", providerId] as const,
  dialogs: () => ["tts", "dialogs"] as const,
  annotations: (dialogId: number) => ["tts", "annotations", dialogId] as const,
};

export function useTtsProviders() {
  return useQuery({
    queryKey: ttsKeys.providers(),
    queryFn: () => api.get<Provider[]>("/providers?type=tts"),
  });
}

export function useTtsVoices(providerId: string | null) {
  return useQuery({
    queryKey: ttsKeys.voices(providerId ?? ""),
    queryFn: () => api.get<Voice[]>(`/tts/${providerId}/voices`),
    enabled: providerId !== null,
  });
}

export function useDialogs() {
  return useQuery({
    queryKey: ttsKeys.dialogs(),
    queryFn: () => api.get<Dialog[]>("/dialogs"),
  });
}

export function useAnnotationsByDialog(dialogId: number | null) {
  return useQuery({
    queryKey: ttsKeys.annotations(dialogId ?? 0),
    queryFn: () =>
      api.get<AnnotatedDialog[]>(`/dialogs/${dialogId}/annotations`),
    enabled: dialogId !== null,
  });
}
