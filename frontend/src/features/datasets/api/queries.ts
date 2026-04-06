import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type {
  Dialog,
  DialogMessage,
  DialogWithMessages,
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

export const dialogKeys = {
  all: ["dialogs"] as const,
  list: () => [...dialogKeys.all, "list"] as const,
  detail: (dialogId: number) => [...dialogKeys.all, "detail", dialogId] as const,
};

async function fetchDialogs(): Promise<Dialog[]> {
  return api.get<Dialog[]>("/dialogs");
}

async function fetchDialog(dialogId: number): Promise<DialogWithMessages> {
  return api.get<DialogWithMessages>(`/dialogs/${dialogId}`);
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
    }) => api.put<DialogMessage>(`/dialogs/${dialogId}/messages/${messageId}`, data),
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
