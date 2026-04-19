import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type { Provider, ProviderKeyTestResponse, ProviderType } from "../../../types/api.ts";

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

export function providerKeyTestQueryKey(id: string) {
  return ["provider-key-test", id] as const;
}

export function testProviderKey(id: string) {
  return api.post<ProviderKeyTestResponse>(`/providers/${id}/key/test`);
}

export function useProviderKeyTest(provider: Pick<Provider, "id" | "has_key">) {
  return useQuery({
    queryKey: providerKeyTestQueryKey(provider.id),
    queryFn: () => testProviderKey(provider.id),
    enabled: provider.has_key,
    retry: false,
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, key }: SetProviderKeyInput) => api.put<void>(`/providers/${id}/key`, { key }),
    onSuccess: (_data, { id }) => {
      queryClient.setQueriesData<Provider[]>({ queryKey: ["providers"] }, (providers) => {
        if (!providers) return providers;
        return providers.map((provider) => (
          provider.id === id ? { ...provider, has_key: true } : provider
        ));
      });
      void queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}
