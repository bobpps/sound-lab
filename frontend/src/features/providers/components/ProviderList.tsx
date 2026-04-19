import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../lib/api-client.ts";
import type { ProviderType } from "../../../types/api.ts";
import { providerKeyTestQueryKey, testProviderKey, useProviders } from "../api/queries.ts";
import { ProviderCard } from "./ProviderCard.tsx";

interface ProviderListProps {
  type: ProviderType;
}

const TYPE_LABELS: Record<ProviderType, string> = {
  tts: "TTS",
  llm: "LLM",
  realtime: "Realtime",
};

export function ProviderList({ type }: ProviderListProps) {
  const queryClient = useQueryClient();
  const providersQuery = useProviders(type);
  const [isTestingAll, setIsTestingAll] = useState(false);

  if (providersQuery.isPending) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
        Loading {TYPE_LABELS[type]} providers...
      </div>
    );
  }

  if (providersQuery.error instanceof ApiError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {providersQuery.error.message}
      </div>
    );
  }

  if (providersQuery.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Unable to load providers right now.
      </div>
    );
  }

  if (!providersQuery.data || providersQuery.data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
        No {TYPE_LABELS[type]} providers are configured yet.
      </div>
    );
  }

  const configuredProviders = providersQuery.data.filter((provider) => provider.has_key);

  async function handleTestAll() {
    if (configuredProviders.length === 0) {
      return;
    }

    setIsTestingAll(true);
    try {
      await Promise.allSettled(
        configuredProviders.map((provider) => (
          queryClient.fetchQuery({
            queryKey: providerKeyTestQueryKey(provider.id),
            queryFn: () => testProviderKey(provider.id),
          })
        )),
      );
    } finally {
      setIsTestingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          {configuredProviders.length} of {providersQuery.data.length} providers have a saved API key.
        </p>
        <button
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
          disabled={configuredProviders.length === 0 || isTestingAll}
          type="button"
          onClick={() => {
            void handleTestAll();
          }}
        >
          {isTestingAll ? "Testing..." : "Test All"}
        </button>
      </div>

      <div className="grid gap-4">
        {providersQuery.data.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}
