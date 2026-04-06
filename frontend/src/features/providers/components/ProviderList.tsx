import { ApiError } from "../../../lib/api-client.ts";
import type { ProviderType } from "../../../types/api.ts";
import { useProviders } from "../api/queries.ts";
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
  const providersQuery = useProviders(type);

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

  return (
    <div className="grid gap-4">
      {providersQuery.data.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}
