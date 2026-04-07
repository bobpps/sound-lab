import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { AnnotationPrompt } from "../../../types/api.ts";
import {
  useAnnotationPrompts,
  useCreateAnnotationPrompt,
  useTtsProviders,
} from "../api/queries.ts";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function sortPrompts(prompts: AnnotationPrompt[]): AnnotationPrompt[] {
  return [...prompts].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

export function PromptList() {
  const navigate = useNavigate();
  const promptsQuery = useAnnotationPrompts();
  const providersQuery = useTtsProviders();
  const createPrompt = useCreateAnnotationPrompt();
  const [createError, setCreateError] = useState<string | null>(null);

  const providers = providersQuery.data ?? [];
  const providerNameById = new Map(
    providers.map((provider) => [provider.id, provider.name]),
  );
  const prompts = promptsQuery.data ? sortPrompts(promptsQuery.data) : [];
  const canCreatePrompt =
    !createPrompt.isPending &&
    !providersQuery.isPending &&
    !providersQuery.isError &&
    providers.length > 0;

  async function handleCreatePrompt() {
    setCreateError(null);

    const providerId = providers[0]?.id;
    if (!providerId) {
      setCreateError("Add at least one TTS provider before creating prompts.");
      return;
    }

    try {
      const prompt = await createPrompt.mutateAsync({
        title: "Untitled prompt",
        provider_id: providerId,
        language: "en-US",
        prompt: "",
      });
      navigate(`/datasets/prompts/${prompt.id}`);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create prompt.",
      );
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Prompts</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage annotation prompt templates and keep them aligned with your
            TTS providers.
          </p>
          {!providersQuery.isPending && providers.length === 0 ? (
            <p className="mt-2 text-sm text-amber-700">
              Add a TTS provider on the Providers page before creating prompts.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleCreatePrompt}
          disabled={!canCreatePrompt}
        >
          {createPrompt.isPending ? "Creating..." : "New Prompt"}
        </button>
      </div>

      {createError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {createError}
        </div>
      ) : null}

      {promptsQuery.isPending ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading prompts...
        </div>
      ) : null}

      {promptsQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {promptsQuery.error instanceof Error
            ? promptsQuery.error.message
            : "Failed to load prompts."}
        </div>
      ) : null}

      {!promptsQuery.isPending && !promptsQuery.isError && prompts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-600 shadow-sm">
          No prompts yet. Create the first one to start annotating dialogs.
        </div>
      ) : null}

      {!promptsQuery.isPending &&
      !promptsQuery.isError &&
      prompts.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">TTS Provider</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prompts.map((prompt) => (
                <tr key={prompt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <Link
                      to={`/datasets/prompts/${prompt.id}`}
                      className="font-medium text-gray-900 underline-offset-2 hover:underline"
                    >
                      {prompt.title}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {prompt.language}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {providerNameById.get(prompt.provider_id) ?? prompt.provider_id}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {formatDate(prompt.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
