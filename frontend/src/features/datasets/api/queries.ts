import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type {
  AnnotationPrompt,
  Dialog,
  DialogMessage,
  DialogWithMessages,
  Provider,
} from "../../../types/api.ts";

export interface CreateDialogInput {
  title: string;
  description?: string;
  language: string;
}

export interface UpdateDialogInput {
  title?: string;
  description?: string;
  language?: string;
}

export interface CreateMessageInput {
  order: number;
  character: 1 | 2;
  text: string;
}

export interface UpdateMessageInput {
  character?: 1 | 2;
  text?: string;
}

export interface CreateAnnotationPromptInput {
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
}

export interface UpdateAnnotationPromptInput {
  title?: string;
  provider_id?: string;
  language?: string;
  prompt?: string;
}

export interface GenerateDialogInput {
  providerId: string;
  model: string;
  language: string;
  prompt: string;
  messageCount: number;
}

export interface EditDialogInput {
  dialogId: number;
  providerId: string;
  model: string;
  instructions: string;
}

export const dialogKeys = {
  all: ["dialogs"] as const,
  list: () => [...dialogKeys.all, "list"] as const,
  detail: (dialogId: number) => [...dialogKeys.all, "detail", dialogId] as const,
};

export const annotationPromptKeys = {
  all: ["annotation-prompts"] as const,
  list: () => [...annotationPromptKeys.all, "list"] as const,
  detail: (promptId: number) =>
    [...annotationPromptKeys.all, "detail", promptId] as const,
};

export const ttsProviderKeys = {
  list: () => ["providers", "tts"] as const,
};

export const llmKeys = {
  all: ["llm"] as const,
  models: (providerId: string) => [...llmKeys.all, "models", providerId] as const,
};

async function fetchDialogs(): Promise<Dialog[]> {
  return api.get<Dialog[]>("/dialogs");
}

async function fetchDialog(dialogId: number): Promise<DialogWithMessages> {
  return api.get<DialogWithMessages>(`/dialogs/${dialogId}`);
}

async function fetchAnnotationPrompts(): Promise<AnnotationPrompt[]> {
  return api.get<AnnotationPrompt[]>("/annotation-prompts");
}

async function fetchAnnotationPrompt(promptId: number): Promise<AnnotationPrompt> {
  return api.get<AnnotationPrompt>(`/annotation-prompts/${promptId}`);
}

async function fetchTtsProviders(): Promise<Provider[]> {
  return api.get<Provider[]>("/providers?type=tts");
}

export function useDialogs() {
  return useQuery({
    queryKey: dialogKeys.list(),
    queryFn: fetchDialogs,
  });
}

export function useDialog(dialogId: number | null) {
  return useQuery({
    queryKey: dialogKeys.detail(dialogId ?? 0),
    queryFn: () => fetchDialog(dialogId!),
    enabled: dialogId !== null,
  });
}

export function useAnnotationPrompts() {
  return useQuery({
    queryKey: annotationPromptKeys.list(),
    queryFn: fetchAnnotationPrompts,
  });
}

export function useAnnotationPrompt(promptId: number | null) {
  return useQuery({
    queryKey: annotationPromptKeys.detail(promptId ?? 0),
    queryFn: () => fetchAnnotationPrompt(promptId!),
    enabled: promptId !== null,
  });
}

export function useTtsProviders() {
  return useQuery({
    queryKey: ttsProviderKeys.list(),
    queryFn: fetchTtsProviders,
  });
}

export function useLlmModels(providerId: string | null) {
  return useQuery({
    queryKey: llmKeys.models(providerId ?? ""),
    queryFn: () => api.get<string[]>(`/llm/${providerId}/models`),
    enabled: providerId !== null && providerId.length > 0,
  });
}

export function useCreateDialog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDialogInput) => api.post<Dialog>("/dialogs", input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dialogKeys.list() });
    },
  });
}

export function useUpdateDialog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dialogId,
      data,
    }: {
      dialogId: number;
      data: UpdateDialogInput;
    }) => api.put<Dialog>(`/dialogs/${dialogId}`, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dialogKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: dialogKeys.detail(variables.dialogId),
        }),
      ]);
    },
  });
}

export function useDeleteDialog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dialogId }: { dialogId: number }) =>
      api.delete(`/dialogs/${dialogId}`),
    onSuccess: async (_, variables) => {
      queryClient.removeQueries({
        queryKey: dialogKeys.detail(variables.dialogId),
      });
      await queryClient.invalidateQueries({ queryKey: dialogKeys.list() });
    },
  });
}

export function useCreateAnnotationPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAnnotationPromptInput) =>
      api.post<AnnotationPrompt>("/annotation-prompts", input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: annotationPromptKeys.list(),
      });
    },
  });
}

export function useUpdateAnnotationPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      promptId,
      data,
    }: {
      promptId: number;
      data: UpdateAnnotationPromptInput;
    }) => api.put<AnnotationPrompt>(`/annotation-prompts/${promptId}`, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: annotationPromptKeys.list(),
        }),
        queryClient.invalidateQueries({
          queryKey: annotationPromptKeys.detail(variables.promptId),
        }),
      ]);
    },
  });
}

export function useDeleteAnnotationPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ promptId }: { promptId: number }) =>
      api.delete(`/annotation-prompts/${promptId}`),
    onSuccess: async (_, variables) => {
      queryClient.removeQueries({
        queryKey: annotationPromptKeys.detail(variables.promptId),
      });
      await queryClient.invalidateQueries({
        queryKey: annotationPromptKeys.list(),
      });
    },
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dialogId,
      data,
    }: {
      dialogId: number;
      data: CreateMessageInput;
    }) => api.post<DialogMessage>(`/dialogs/${dialogId}/messages`, data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: dialogKeys.detail(variables.dialogId),
      });
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dialogId,
      messageId,
      data,
    }: {
      dialogId: number;
      messageId: number;
      data: UpdateMessageInput;
    }) =>
      api.put<DialogMessage>(`/dialogs/${dialogId}/messages/${messageId}`, data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: dialogKeys.detail(variables.dialogId),
      });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dialogId,
      messageId,
    }: {
      dialogId: number;
      messageId: number;
    }) => api.delete(`/dialogs/${dialogId}/messages/${messageId}`),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: dialogKeys.detail(variables.dialogId),
      });
    },
  });
}

export function useGenerateDialog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateDialogInput) =>
      api.post<DialogWithMessages>("/services/generate-dialog", input),
    onSuccess: async (dialog) => {
      queryClient.setQueryData(dialogKeys.detail(dialog.id), dialog);
      await queryClient.invalidateQueries({ queryKey: dialogKeys.list() });
    },
  });
}

export function useEditDialog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EditDialogInput) =>
      api.post<DialogWithMessages>("/services/edit-dialog", input),
    onSuccess: async (dialog) => {
      queryClient.setQueryData(dialogKeys.detail(dialog.id), dialog);
      await queryClient.invalidateQueries({
        queryKey: dialogKeys.detail(dialog.id),
      });
    },
  });
}
