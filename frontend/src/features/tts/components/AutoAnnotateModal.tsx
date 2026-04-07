import { useState } from "react";
import {
  useAnnotationPrompts,
  useAutoAnnotate,
  useLlmModels,
  useLlmProviders,
} from "../api/queries.ts";

interface AutoAnnotateModalProps {
  dialogId: number;
  ttsProviderId: string;
  onClose: () => void;
  onAnnotationCreated?: (annotationId: number) => void;
}

export function AutoAnnotateModal({
  dialogId,
  ttsProviderId,
  onClose,
  onAnnotationCreated,
}: AutoAnnotateModalProps) {
  const [selectedLlmProviderId, setSelectedLlmProviderId] = useState<
    string | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [title, setTitle] = useState("Auto-annotated");
  const [error, setError] = useState<string | null>(null);

  const llmProvidersQuery = useLlmProviders();
  const llmModelsQuery = useLlmModels(selectedLlmProviderId);
  const annotationPromptsQuery = useAnnotationPrompts();
  const autoAnnotate = useAutoAnnotate();

  const filteredPrompts =
    annotationPromptsQuery.data?.filter(
      (p) => p.provider_id === ttsProviderId,
    ) ?? [];

  const canSubmit =
    selectedLlmProviderId !== null &&
    selectedModel !== null &&
    selectedPromptId !== null &&
    title.trim().length > 0 &&
    !autoAnnotate.isPending;

  async function handleSubmit() {
    if (
      !selectedLlmProviderId ||
      !selectedModel ||
      !selectedPromptId ||
      !title.trim()
    ) {
      return;
    }

    setError(null);

    try {
      const result = await autoAnnotate.mutateAsync({
        dialogId,
        providerId: selectedLlmProviderId,
        model: selectedModel,
        annotationPromptId: selectedPromptId,
        ttsProviderId,
        title: title.trim(),
      });

      onAnnotationCreated?.(result.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Auto-annotation failed.",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Auto-Annotate"
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-gray-900">Auto-Annotate</h3>
        <p className="mt-1 text-sm text-gray-600">
          Use an LLM to automatically generate annotation text.
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {/* LLM Provider */}
          <div className="space-y-1">
            <label
              htmlFor="auto-annotate-llm-provider"
              className="block text-sm font-medium text-gray-700"
            >
              LLM Provider
            </label>
            <select
              id="auto-annotate-llm-provider"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={selectedLlmProviderId ?? ""}
              onChange={(e) => {
                setSelectedLlmProviderId(e.target.value || null);
                setSelectedModel(null);
              }}
            >
              <option value="" disabled>
                Select an LLM provider...
              </option>
              {llmProvidersQuery.data
                ?.filter((p) => p.enabled)
                .map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Model */}
          {selectedLlmProviderId !== null ? (
            <div className="space-y-1">
              <label
                htmlFor="auto-annotate-model"
                className="block text-sm font-medium text-gray-700"
              >
                Model
              </label>
              <select
                id="auto-annotate-model"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                value={selectedModel ?? ""}
                onChange={(e) => setSelectedModel(e.target.value || null)}
              >
                <option value="" disabled>
                  {llmModelsQuery.isPending
                    ? "Loading models..."
                    : "Select a model..."}
                </option>
                {llmModelsQuery.data?.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Annotation Prompt */}
          <div className="space-y-1">
            <label
              htmlFor="auto-annotate-prompt"
              className="block text-sm font-medium text-gray-700"
            >
              Annotation Prompt
            </label>
            <select
              id="auto-annotate-prompt"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={selectedPromptId !== null ? String(selectedPromptId) : ""}
              onChange={(e) =>
                setSelectedPromptId(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="" disabled>
                {annotationPromptsQuery.isPending
                  ? "Loading prompts..."
                  : "Select a prompt..."}
              </option>
              {filteredPrompts.map((prompt) => (
                <option key={prompt.id} value={String(prompt.id)}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label
              htmlFor="auto-annotate-title"
              className="block text-sm font-medium text-gray-700"
            >
              Title
            </label>
            <input
              id="auto-annotate-title"
              type="text"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {autoAnnotate.isPending ? "Running..." : "Run Auto-Annotate"}
          </button>
        </div>
      </div>
    </div>
  );
}
