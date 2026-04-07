import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type {
  AnnotatedDialog,
  AnnotatedDialogWithMessages,
  AnnotatedMessage,
  AnnotationPrompt,
  Dialog,
  DialogWithMessages,
  Provider,
  Voice,
} from "../../../types/api.ts";

export const ttsKeys = {
  providers: () => ["tts", "providers"] as const,
  voices: (providerId: string) => ["tts", "voices", providerId] as const,
  dialogs: () => ["tts", "dialogs"] as const,
  annotations: (dialogId: number) => ["tts", "annotations", dialogId] as const,
  annotation: (annotationId: number) =>
    ["tts", "annotation", annotationId] as const,
  dialogDetail: (dialogId: number) =>
    ["tts", "dialog-detail", dialogId] as const,
  llmProviders: () => ["tts", "llmProviders"] as const,
  llmModels: (providerId: string) =>
    ["tts", "llmModels", providerId] as const,
  annotationPrompts: () => ["tts", "annotationPrompts"] as const,
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

export function useAnnotation(annotationId: number | null) {
  return useQuery({
    queryKey: ttsKeys.annotation(annotationId ?? 0),
    queryFn: () =>
      api.get<AnnotatedDialogWithMessages>(`/annotations/${annotationId}`),
    enabled: annotationId !== null,
  });
}

export function useDialogDetail(dialogId: number | null) {
  return useQuery({
    queryKey: ttsKeys.dialogDetail(dialogId ?? 0),
    queryFn: () => api.get<DialogWithMessages>(`/dialogs/${dialogId}`),
    enabled: dialogId !== null,
  });
}

export function useLlmProviders() {
  return useQuery({
    queryKey: ttsKeys.llmProviders(),
    queryFn: () => api.get<Provider[]>("/providers?type=llm"),
  });
}

export function useLlmModels(providerId: string | null) {
  return useQuery({
    queryKey: ttsKeys.llmModels(providerId ?? ""),
    queryFn: () => api.get<string[]>(`/llm/${providerId}/models`),
    enabled: providerId !== null,
  });
}

export function useAnnotationPrompts() {
  return useQuery({
    queryKey: ttsKeys.annotationPrompts(),
    queryFn: () => api.get<AnnotationPrompt[]>("/annotation-prompts"),
  });
}

// --- Mutation input types ---

export interface AutoAnnotateInput {
  dialogId: number;
  providerId: string;
  model: string;
  annotationPromptId: number;
  ttsProviderId: string;
  title: string;
}

export interface CreateAnnotationInput {
  provider_id: string;
  title: string;
}

export interface CreateAnnotationMessageInput {
  dialog_message_id: number;
  text: string;
}

export interface UpdateAnnotatedMessageInput {
  text: string;
}

// --- Mutation hooks ---

export function useAutoAnnotate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AutoAnnotateInput) =>
      api.post<AnnotatedDialogWithMessages>("/services/annotate", input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ttsKeys.annotations(data.dialog_id),
      });
    },
  });
}

export function useCreateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dialogId,
      data,
    }: {
      dialogId: number;
      data: CreateAnnotationInput;
    }) => api.post<AnnotatedDialog>(`/dialogs/${dialogId}/annotations`, data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ttsKeys.annotations(variables.dialogId),
      });
    },
  });
}

export function useCreateAnnotationMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      annotationId,
      data,
    }: {
      annotationId: number;
      data: CreateAnnotationMessageInput;
    }) =>
      api.post<AnnotatedMessage>(
        `/annotations/${annotationId}/messages`,
        data,
      ),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ttsKeys.annotation(variables.annotationId),
      });
    },
  });
}

export function useUpdateAnnotatedMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      annotationId,
      messageId,
      data,
    }: {
      annotationId: number;
      messageId: number;
      data: UpdateAnnotatedMessageInput;
    }) =>
      api.put<AnnotatedMessage>(
        `/annotations/${annotationId}/messages/${messageId}`,
        data,
      ),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ttsKeys.annotation(variables.annotationId),
      });
    },
  });
}
