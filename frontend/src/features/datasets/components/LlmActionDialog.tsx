import { useState } from "react";
import { Modal } from "../../../components/ui/Modal.tsx";
import { useProviders } from "../../providers/api/queries.ts";
import type { DialogWithMessages } from "../../../types/api.ts";
import {
  useEditDialog,
  useGenerateDialog,
  useLlmModels,
} from "../api/queries.ts";

export type LlmActionMode = "generate" | "edit";

interface LlmActionDialogProps {
  mode: LlmActionMode;
  dialogId?: number;
  initialLanguage?: string;
  initialMessageCount?: number;
  onClose: () => void;
  onSuccess: (dialog: DialogWithMessages) => void | Promise<void>;
}

const DEFAULT_LANGUAGE = "en-US";
const DEFAULT_MESSAGE_COUNT = 6;

function getMutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function LlmActionDialog({
  mode,
  dialogId,
  initialLanguage = DEFAULT_LANGUAGE,
  initialMessageCount = DEFAULT_MESSAGE_COUNT,
  onClose,
  onSuccess,
}: LlmActionDialogProps) {
  const providersQuery = useProviders("llm");
  const providers = (providersQuery.data ?? []).filter((provider) => provider.enabled);

  const [selectedProviderId, setSelectedProviderId] = useState("");
  const providerId = selectedProviderId || providers[0]?.id || "";
  const modelsQuery = useLlmModels(providerId || null);
  const [selectedModel, setSelectedModel] = useState("");
  const model =
    modelsQuery.data?.includes(selectedModel)
      ? selectedModel
      : (modelsQuery.data?.[0] ?? "");
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState(initialLanguage);
  const [messageCount, setMessageCount] = useState(String(initialMessageCount));
  const [formError, setFormError] = useState<string | null>(null);

  const generateDialog = useGenerateDialog();
  const editDialog = useEditDialog();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const trimmedPrompt = prompt.trim();
    if (!providerId) {
      setFormError("Choose an LLM provider.");
      return;
    }

    if (!model) {
      setFormError("Choose an LLM model.");
      return;
    }

    if (!trimmedPrompt) {
      setFormError(
        mode === "generate" ? "Prompt is required." : "Instructions are required.",
      );
      return;
    }

    try {
      if (mode === "generate") {
        const trimmedLanguage = language.trim();
        const parsedMessageCount = Number(messageCount);

        if (!trimmedLanguage) {
          setFormError("Language is required.");
          return;
        }

        if (
          !Number.isInteger(parsedMessageCount) ||
          parsedMessageCount < 2 ||
          parsedMessageCount > 50
        ) {
          setFormError("Message count must be an integer between 2 and 50.");
          return;
        }

        const dialog = await generateDialog.mutateAsync({
          providerId,
          model,
          language: trimmedLanguage,
          prompt: trimmedPrompt,
          messageCount: parsedMessageCount,
        });
        await onSuccess(dialog);
        return;
      }

      if (!dialogId) {
        setFormError("Dialog id is required for LLM editing.");
        return;
      }

      const dialog = await editDialog.mutateAsync({
        dialogId,
        providerId,
        model,
        instructions: trimmedPrompt,
      });
      await onSuccess(dialog);
    } catch (error) {
      setFormError(
        getMutationErrorMessage(
          error,
          mode === "generate"
            ? "Failed to generate dialog."
            : "Failed to edit dialog with LLM.",
        ),
      );
    }
  }

  const submitLabel =
    mode === "generate"
      ? generateDialog.isPending
        ? "Generating..."
        : "Generate Dialog"
      : editDialog.isPending
        ? "Applying..."
        : "Apply Edit";

  const isSubmitting = generateDialog.isPending || editDialog.isPending;
  const hasProviderError =
    providersQuery.isError ||
    (providerId.length > 0 && modelsQuery.isError);
  const providerErrorMessage = providersQuery.isError
    ? getMutationErrorMessage(providersQuery.error, "Failed to load LLM providers.")
    : modelsQuery.isError
      ? getMutationErrorMessage(modelsQuery.error, "Failed to load models.")
      : null;

  const isSubmitDisabled =
    isSubmitting ||
    providersQuery.isPending ||
    providers.length === 0 ||
    providerId.length === 0 ||
    modelsQuery.isPending ||
    model.length === 0 ||
    prompt.trim().length === 0 ||
    (mode === "generate" &&
      (language.trim().length === 0 || Number(messageCount) < 2));

  return (
    <Modal
      title={mode === "generate" ? "Generate Dialog" : "Edit Dialog with LLM"}
      description={
        mode === "generate"
          ? "Choose a provider, model, language, and prompt to create a new dialog."
          : "Choose a provider and model, then describe the edit. LLM edits apply to the saved dialog on the server."
      }
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            LLM Provider
            <select
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={providerId}
              onChange={(event) => {
                setFormError(null);
                setSelectedProviderId(event.target.value);
                setSelectedModel("");
              }}
              disabled={providersQuery.isPending || providers.length === 0 || isSubmitting}
            >
              {providers.length === 0 ? (
                <option value="">
                  {providersQuery.isPending
                    ? "Loading providers..."
                    : "No enabled LLM providers"}
                </option>
              ) : null}
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Model
            <select
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={model}
              onChange={(event) => {
                setFormError(null);
                setSelectedModel(event.target.value);
              }}
              disabled={providerId.length === 0 || modelsQuery.isPending || isSubmitting}
            >
              {providerId.length === 0 ? (
                <option value="">Select a provider first</option>
              ) : modelsQuery.isPending ? (
                <option value="">Loading models...</option>
              ) : modelsQuery.data && modelsQuery.data.length > 0 ? null : (
                <option value="">No models available</option>
              )}
              {modelsQuery.data?.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode === "generate" ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Language
              <input
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                type="text"
                value={language}
                onChange={(event) => {
                  setFormError(null);
                  setLanguage(event.target.value);
                }}
                disabled={isSubmitting}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Message count
              <input
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                max={50}
                min={2}
                step={1}
                type="number"
                value={messageCount}
                onChange={(event) => {
                  setFormError(null);
                  setMessageCount(event.target.value);
                }}
                disabled={isSubmitting}
              />
            </label>
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          {mode === "generate" ? "Prompt" : "Instructions"}
          <textarea
            className="min-h-32 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            placeholder={
              mode === "generate"
                ? "Describe the dialog you want to generate"
                : "Describe how the current dialog should change"
            }
            value={prompt}
            onChange={(event) => {
              setFormError(null);
              setPrompt(event.target.value);
            }}
            disabled={isSubmitting}
          />
        </label>

        {hasProviderError && providerErrorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {providerErrorMessage}
          </div>
        ) : null}

        {formError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            disabled={isSubmitDisabled}
            type="submit"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
