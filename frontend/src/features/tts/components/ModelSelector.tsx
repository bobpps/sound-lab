import { useTtsModels } from "../api/queries.ts";

interface ModelSelectorProps {
  providerId: string | null;
  selectedModel: string | null;
  onSelect: (model: string) => void;
}

export function ModelSelector({
  providerId,
  selectedModel,
  onSelect,
}: ModelSelectorProps) {
  const modelsQuery = useTtsModels(providerId);

  if (modelsQuery.isPending) {
    return <div className="text-sm text-gray-500">Loading models...</div>;
  }

  if (modelsQuery.isError) {
    return <div className="text-sm text-red-600">Failed to load models.</div>;
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor="tts-model-select"
        className="block text-sm font-medium text-gray-700"
      >
        TTS Model
      </label>
      <select
        id="tts-model-select"
        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        value={selectedModel ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          Select a model...
        </option>
        {modelsQuery.data.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
}
