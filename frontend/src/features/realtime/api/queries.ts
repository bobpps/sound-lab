import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type { AgentPrompt } from "../../../types/api.ts";

export interface CreateAgentPromptInput {
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
}

export const realtimeKeys = {
  all: ["realtime"] as const,
  agentPrompts: (providerId: string | null = null) =>
    [...realtimeKeys.all, "agent-prompts", providerId ?? "all"] as const,
  models: (providerId: string) => [...realtimeKeys.all, "models", providerId] as const,
};

export function useAgentPrompts(providerId: string | null = null) {
  return useQuery({
    queryKey: realtimeKeys.agentPrompts(providerId),
    queryFn: async () => {
      const prompts = await api.get<AgentPrompt[]>("/agent-prompts");

      if (!providerId) {
        return prompts;
      }

      return prompts.filter((prompt) => prompt.provider_id === providerId);
    },
  });
}

export function useCreateAgentPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAgentPromptInput) =>
      api.post<AgentPrompt>("/agent-prompts", input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...realtimeKeys.all, "agent-prompts"],
      });
    },
  });
}

export function useRealtimeModels(providerId: string | null) {
  return useQuery({
    queryKey: realtimeKeys.models(providerId ?? ""),
    queryFn: () => api.get<string[]>(`/realtime/${providerId}/models`),
    enabled: providerId !== null && providerId.length > 0,
  });
}
