import { useTtsProviders } from "../api/queries.ts";

interface ProviderSelectorProps {
  selectedId: string | null;
  onSelect: (providerId: string) => void;
}

export function ProviderSelector({
  selectedId,
  onSelect,
}: ProviderSelectorProps) {
  const providersQuery = useTtsProviders();

  if (providersQuery.isPending) {
    return (
      <div className="text-sm text-gray-500">Loading providers...</div>
    );
  }

  if (providersQuery.isError) {
    return (
      <div className="text-sm text-red-600">Failed to load providers.</div>
    );
  }

  const enabledProviders = providersQuery.data.filter((p) => p.enabled);

  return (
    <div className="space-y-1">
      <label
        htmlFor="tts-provider-select"
        className="block text-sm font-medium text-gray-700"
      >
        TTS Provider
      </label>
      <select
        id="tts-provider-select"
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          Select a provider...
        </option>
        {enabledProviders.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
    </div>
  );
}
