import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type {
  AnnotatedDialog,
  AnnotatedDialogWithMessages,
  Voice,
} from "../../../types/api.ts";

export const ttsVoiceKeys = {
  all: ["tts-voices"] as const,
  list: (providerId: string) => [...ttsVoiceKeys.all, providerId] as const,
};

export const annotationKeys = {
  all: ["annotations"] as const,
  byDialog: (dialogId: number) =>
    [...annotationKeys.all, "dialog", dialogId] as const,
  detail: (annotationId: number) =>
    [...annotationKeys.all, "detail", annotationId] as const,
};

export function useTtsVoices(providerId: string | null) {
  return useQuery({
    queryKey: ttsVoiceKeys.list(providerId ?? ""),
    queryFn: () => api.get<Voice[]>(`/tts/${providerId}/voices`),
    enabled: providerId !== null,
  });
}

export function useAnnotations(dialogId: number | null) {
  return useQuery({
    queryKey: annotationKeys.byDialog(dialogId ?? 0),
    queryFn: () =>
      api.get<AnnotatedDialog[]>(`/dialogs/${dialogId}/annotations`),
    enabled: dialogId !== null,
  });
}

export function useAnnotation(annotationId: number | null) {
  return useQuery({
    queryKey: annotationKeys.detail(annotationId ?? 0),
    queryFn: () =>
      api.get<AnnotatedDialogWithMessages>(`/annotations/${annotationId}`),
    enabled: annotationId !== null,
  });
}
