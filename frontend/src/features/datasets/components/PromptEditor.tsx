import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { AnnotationPrompt, Provider } from "../../../types/api.ts";
import {
  useAnnotationPrompt,
  useDeleteAnnotationPrompt,
  useTtsProviders,
  useUpdateAnnotationPrompt,
} from "../api/queries.ts";

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "German" },
  { value: "fr-FR", label: "French" },
  { value: "es-ES", label: "Spanish" },
] as const;

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getProviderOptions(
  providers: Provider[],
  currentProviderId: string,
): Provider[] {
  if (!currentProviderId || providers.some((provider) => provider.id === currentProviderId)) {
    return providers;
  }

  return [
    ...providers,
    {
      id: currentProviderId,
      name: currentProviderId,
      type: "tts",
      enabled: false,
      has_key: false,
      created_at: "",
    },
  ];
}

export function PromptEditor() {
  const navigate = useNavigate();
  const params = useParams();
  const parsedPromptId = Number(params.promptId);
  const promptId =
    Number.isInteger(parsedPromptId) && parsedPromptId > 0
      ? parsedPromptId
      : null;

  const promptQuery = useAnnotationPrompt(promptId);
  const providersQuery = useTtsProviders();
  const updatePrompt = useUpdateAnnotationPrompt();
  const deletePrompt = useDeleteAnnotationPrompt();

  const hydratedPromptIdRef = useRef<number | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [providerId, setProviderId] = useState("");
  const [promptBody, setPromptBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  function hydratePrompt(prompt: AnnotationPrompt) {
    setTitle(prompt.title);
    setLanguage(prompt.language);
    setProviderId(prompt.provider_id);
    setPromptBody(prompt.prompt);
    setFormError(null);
    setFormNotice(null);
  }

  useEffect(() => {
    hydratedPromptIdRef.current = null;
  }, [promptId]);

  useEffect(() => {
    if (!promptQuery.data || promptId === null) {
      return;
    }

    if (hydratedPromptIdRef.current === promptId) {
      return;
    }

    // The editor keeps a local draft separate from the query cache.
    // This hydration runs only when switching to a different prompt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    hydratePrompt(promptQuery.data);
    hydratedPromptIdRef.current = promptId;
  }, [promptId, promptQuery.data]);

  function clearFeedback() {
    if (formError) {
      setFormError(null);
    }
    if (formNotice) {
      setFormNotice(null);
    }
  }

  async function handleSave() {
    clearFeedback();

    if (!promptId || !promptQuery.data) {
      setFormError("Prompt not found.");
      return;
    }

    const nextTitle = title.trim();
    const nextLanguage = language.trim();
    const nextProviderId = providerId.trim();

    if (!nextTitle) {
      setFormError("Title is required.");
      return;
    }

    if (!nextLanguage) {
      setFormError("Language is required.");
      return;
    }

    if (!nextProviderId) {
      setFormError("TTS provider is required.");
      return;
    }

    try {
      await updatePrompt.mutateAsync({
        promptId,
        data: {
          title: nextTitle,
          language: nextLanguage,
          provider_id: nextProviderId,
          prompt: promptBody,
        },
      });

      const refreshedPrompt = await promptQuery.refetch();
      if (refreshedPrompt.data) {
        hydratePrompt(refreshedPrompt.data);
        hydratedPromptIdRef.current = promptId;
      }
      setFormNotice("Prompt saved.");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save prompt.",
      );
    }
  }

  async function handleDeletePrompt() {
    clearFeedback();

    if (!promptId) {
      return;
    }

    if (!window.confirm("Delete this prompt?")) {
      return;
    }

    try {
      await deletePrompt.mutateAsync({ promptId });
      navigate("/datasets");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to delete prompt.",
      );
    }
  }

  const isSaving = updatePrompt.isPending || deletePrompt.isPending;
  const providerOptions = getProviderOptions(
    providersQuery.data ?? [],
    providerId,
  );

  if (promptId === null) {
    return (
      <div className="space-y-4">
        <Link
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
          to="/datasets"
        >
          Back to datasets
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          Invalid prompt id.
        </div>
      </div>
    );
  }

  if (promptQuery.isPending) {
    return (
      <div className="space-y-4">
        <Link
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
          to="/datasets"
        >
          Back to datasets
        </Link>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading prompt...
        </div>
      </div>
    );
  }

  if (promptQuery.isError || !promptQuery.data) {
    return (
      <div className="space-y-4">
        <Link
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
          to="/datasets"
        >
          Back to datasets
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {promptQuery.error instanceof Error
            ? promptQuery.error.message
            : "Failed to load prompt."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
            to="/datasets"
          >
            Back to datasets
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Prompt Editor</h1>
          <p className="mt-1 text-sm text-gray-600">
            Created {formatTimestamp(promptQuery.data.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDeletePrompt}
            disabled={isSaving}
          >
            Delete Prompt
          </button>
          <button
            type="button"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Prompt"}
          </button>
        </div>
      </div>

      {formError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      {formNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {formNotice}
        </div>
      ) : null}

      {providersQuery.isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Unable to refresh the TTS provider list right now. You can still keep
          the current provider selection.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Metadata</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-600 md:col-span-2">
                Title
                <input
                  type="text"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={title}
                  onChange={(event) => {
                    clearFeedback();
                    setTitle(event.target.value);
                  }}
                  disabled={isSaving}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Language
                <select
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={language}
                  onChange={(event) => {
                    clearFeedback();
                    setLanguage(event.target.value);
                  }}
                  disabled={isSaving}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-gray-600">
                TTS Provider
                <select
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={providerId}
                  onChange={(event) => {
                    clearFeedback();
                    setProviderId(event.target.value);
                  }}
                  disabled={isSaving || providersQuery.isPending}
                >
                  <option value="">Select a provider</option>
                  {providerOptions.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Prompt Body</h2>
            <p className="mt-1 text-sm text-gray-600">
              Write the annotation instructions exactly as they should be sent
              to the model.
            </p>

            <label className="mt-4 flex flex-col gap-1 text-sm text-gray-600">
              Prompt body
              <textarea
                className="min-h-64 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900"
                value={promptBody}
                onChange={(event) => {
                  clearFeedback();
                  setPromptBody(event.target.value);
                }}
                disabled={isSaving}
              />
            </label>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500">Prompt ID</dt>
                <dd className="font-medium text-gray-900">{promptQuery.data.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500">Language</dt>
                <dd className="font-medium text-gray-900">{language || "-"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500">Provider</dt>
                <dd className="font-medium text-gray-900">{providerId || "-"}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>
    </div>
  );
}
