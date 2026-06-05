import { useState } from "react";
import type { AgentPrompt, Voice } from "../../../types/api.ts";
import type { RealtimeConnectConfig } from "../hooks/useRealtimeSession.ts";

export interface CreatePromptDraft {
  language: string;
  prompt: string;
  title: string;
}

interface SessionControlsProps {
  error: string | null;
  isActive: boolean;
  isBusy: boolean;
  isCreatingPrompt: boolean;
  isModelsLoading: boolean;
  isPromptsLoading: boolean;
  isVoicesLoading: boolean;
  languageMode: "auto-only" | "configurable";
  models: string[];
  modelsError: string | null;
  prompts: AgentPrompt[];
  promptsError: string | null;
  providerLabel: string;
  selectedModel: string;
  voices: Voice[];
  voicesError: string | null;
  onCreatePrompt: (draft: CreatePromptDraft) => Promise<AgentPrompt>;
  onModelChange: (model: string) => void;
  onStart: (config: RealtimeConnectConfig) => Promise<void>;
  onStop: () => Promise<void> | void;
}

function formatModelName(model: string): string {
  return model.replace(/^models\//, "");
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatVoiceName(voice: Voice): string {
  return [voice.name, voice.gender].filter(Boolean).join(" · ");
}

export function SessionControls({
  error,
  isActive,
  isBusy,
  isCreatingPrompt,
  isModelsLoading,
  isPromptsLoading,
  isVoicesLoading,
  languageMode,
  models,
  modelsError,
  prompts,
  promptsError,
  providerLabel,
  selectedModel,
  voices,
  voicesError,
  onCreatePrompt,
  onModelChange,
  onStart,
  onStop,
}: SessionControlsProps) {
  const [createError, setCreateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [newPromptLanguage, setNewPromptLanguage] = useState("en-US");
  const [newPromptBody, setNewPromptBody] = useState("");
  const resolvedModel =
    models.find((model) => model === selectedModel) ?? models[0] ?? "";
  const resolvedPromptId =
    prompts.find((prompt) => String(prompt.id) === selectedPromptId)
      ? selectedPromptId
      : prompts[0]
        ? String(prompts[0].id)
        : "";
  const selectedPrompt =
    prompts.find((prompt) => String(prompt.id) === resolvedPromptId) ?? null;
  // Language is driven entirely by the selected prompt. A prompt with no
  // language (and any "auto-only" provider such as Gemini) leaves it unset, so
  // the provider auto-detects the language.
  const resolvedLanguage =
    languageMode === "configurable" ? selectedPrompt?.language?.trim() ?? "" : "";
  const resolvedVoiceId =
    voices.find((voice) => voice.id === selectedVoiceId)?.id ??
    voices[0]?.id ??
    "";

  async function handleStart() {
    setFormError(null);

    if (!resolvedModel) {
      setFormError("Select a realtime model before starting the session.");
      return;
    }

    if (!selectedPrompt) {
      setFormError("Select or create an agent prompt before starting.");
      return;
    }

    try {
      await onStart({
        language: resolvedLanguage || undefined,
        model: resolvedModel,
        systemPrompt: selectedPrompt.prompt,
        voice: resolvedVoiceId || undefined,
      });
    } catch (startError) {
      setFormError(
        getErrorMessage(startError, "Unable to start the realtime session."),
      );
    }
  }

  async function handleCreatePrompt() {
    setCreateError(null);

    const title = newPromptTitle.trim();
    const language = newPromptLanguage.trim();
    const prompt = newPromptBody.trim();

    if (!title) {
      setCreateError("Prompt title is required.");
      return;
    }

    if (!prompt) {
      setCreateError("Prompt body is required.");
      return;
    }

    try {
      const createdPrompt = await onCreatePrompt({
        language,
        prompt,
        title,
      });

      setSelectedPromptId(String(createdPrompt.id));
      setNewPromptTitle("");
      setNewPromptLanguage(language);
      setNewPromptBody("");
      setIsCreateOpen(false);
    } catch (createPromptError) {
      setCreateError(
        getErrorMessage(createPromptError, "Unable to create the prompt."),
      );
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {providerLabel} Session
          </h2>
          <p className="max-w-2xl text-sm text-gray-600">
            Choose a model and an agent prompt, then start a live websocket
            session with microphone streaming and transcript playback.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
              isActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-600",
            ].join(" ")}
          >
            {isActive ? "Connected" : "Idle"}
          </span>

          {isActive ? (
            <button
              type="button"
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void onStop();
              }}
              disabled={isBusy}
            >
              Stop Session
            </button>
          ) : (
            <button
              type="button"
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleStart();
              }}
              disabled={
                isBusy ||
                isModelsLoading ||
                isPromptsLoading ||
                models.length === 0
              }
            >
              {isBusy ? "Starting..." : "Start Session"}
            </button>
          )}
        </div>
      </div>

      {modelsError ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {modelsError}
        </div>
      ) : null}

      {promptsError ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {promptsError}
        </div>
      ) : null}

      {voicesError ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {voicesError}
        </div>
      ) : null}

      {formError || error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError ?? error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Model
          <select
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            value={resolvedModel}
            onChange={(event) => {
              setFormError(null);
              setSelectedVoiceId("");
              onModelChange(event.target.value);
            }}
            disabled={isActive || isBusy || isModelsLoading || models.length === 0}
          >
            {isModelsLoading ? (
              <option value="">Loading models...</option>
            ) : models.length > 0 ? (
              models.map((model) => (
                <option key={model} value={model}>
                  {formatModelName(model)}
                </option>
              ))
            ) : (
              <option value="">No models available</option>
            )}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Voice
          <select
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            value={resolvedVoiceId}
            onChange={(event) => {
              setFormError(null);
              setSelectedVoiceId(event.target.value);
            }}
            disabled={isActive || isBusy || isVoicesLoading || voices.length === 0}
          >
            {isVoicesLoading ? (
              <option value="">Loading voices...</option>
            ) : voices.length > 0 ? (
              voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {formatVoiceName(voice)}
                </option>
              ))
            ) : (
              <option value="">Provider default</option>
            )}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Agent Prompt
          <select
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            value={resolvedPromptId}
            onChange={(event) => {
              setFormError(null);
              setSelectedPromptId(event.target.value);
            }}
            disabled={isActive || isBusy || isPromptsLoading || prompts.length === 0}
          >
            {isPromptsLoading ? (
              <option value="">Loading prompts...</option>
            ) : prompts.length > 0 ? (
              prompts.map((prompt) => (
                <option key={prompt.id} value={String(prompt.id)}>
                  {prompt.title}
                </option>
              ))
            ) : (
              <option value="">No prompts available</option>
            )}
          </select>
        </label>
      </div>

      {selectedPrompt ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                {selectedPrompt.title}
              </h3>
              <p className="text-xs text-gray-500">
                Language: {selectedPrompt.language.trim() || "Auto-detect"}
              </p>
            </div>

            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-white"
              onClick={() => {
                setCreateError(null);
                setIsCreateOpen((current) => !current);
              }}
              disabled={isActive || isBusy}
            >
              {isCreateOpen ? "Hide Create Form" : "Create Prompt"}
            </button>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
            {selectedPrompt.prompt}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <span>Create the first prompt for this provider to unlock live sessions.</span>
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-white"
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            disabled={isActive || isBusy}
          >
            Create Prompt
          </button>
        </div>
      )}

      {isCreateOpen ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Prompt title
              <input
                type="text"
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                value={newPromptTitle}
                onChange={(event) => setNewPromptTitle(event.target.value)}
                disabled={isCreatingPrompt || isActive}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Language
              <input
                type="text"
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                value={newPromptLanguage}
                onChange={(event) => setNewPromptLanguage(event.target.value)}
                placeholder="Leave empty to auto-detect"
                disabled={isCreatingPrompt || isActive}
              />
            </label>
          </div>

          <label className="mt-4 flex flex-col gap-1 text-sm text-gray-600">
            Prompt body
            <textarea
              className="min-h-32 rounded-xl border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900"
              value={newPromptBody}
              onChange={(event) => setNewPromptBody(event.target.value)}
              disabled={isCreatingPrompt || isActive}
            />
          </label>

          {createError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {createError}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleCreatePrompt();
              }}
              disabled={isCreatingPrompt || isActive}
            >
              {isCreatingPrompt ? "Saving..." : "Save Prompt"}
            </button>

            <button
              type="button"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreatingPrompt}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
