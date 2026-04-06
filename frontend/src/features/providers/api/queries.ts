import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type { Provider, ProviderType } from "../../../types/api.ts";

interface UpdateProviderInput {
  id: string;
  data: Partial<Pick<Provider, "name" | "type" | "enabled">>;
}

interface SetProviderKeyInput {
  id: string;
  key: string;
}

export function useProviders(type: ProviderType) {
  return useQuery({
    queryKey: ["providers", type],
    queryFn: () => api.get<Provider[]>(`/providers?type=${type}`),
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateProviderInput) => api.put<Provider>(`/providers/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useSetProviderKey() {
  return useMutation({
    mutationFn: ({ id, key }: SetProviderKeyInput) => api.put<void>(`/providers/${id}/key`, { key }),
  });
}
