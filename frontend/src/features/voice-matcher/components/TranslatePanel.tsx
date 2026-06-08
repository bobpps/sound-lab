import { ApiError } from "../../../lib/api-client.ts";
import { useLlmModels, useLlmProviders, useTranslate } from "../api/queries.ts";
import { pickCheapModel } from "../lib/translate.ts";

interface TranslatePanelProps {
  /** Target language for the translation (BCP-47 locale from "Standard locale"). */
  targetLocale: string | null;
  /** Persisted selected provider id (lifted to the page). */
  providerId: string | null;
  onProviderChange: (providerId: string | null) => void;
  /** Persisted source text to translate (lifted to the page). */
  source: string;
  onSourceChange: (source: string) => void;
  /** Called with the translated text, which the page writes into "Phrase". */
  onTranslated: (text: string) => void;
}

export function TranslatePanel({
  targetLocale,
  providerId,
  onProviderChange,
  source,
  onSourceChange,
  onTranslated,
}: TranslatePanelProps) {
  const { data: providers } = useLlmProviders();
  // Only providers that are active and have an API key configured.
  const available = (Array.isArray(providers) ? providers : []).filter(
    (p) => p.enabled && p.has_key,
  );

  // A persisted provider may no longer be available (disabled / key removed);
  // treat it as "not selected" so the form stays in a safe state.
  const effectiveProviderId =
    providerId !== null && available.some((p) => p.id === providerId)
      ? providerId
      : null;
  const hasProvider = effectiveProviderId !== null;

  const { data: models } = useLlmModels(effectiveProviderId);
  const model = pickCheapModel(models ?? []);
  const translate = useTranslate();

  const canTranslate =
    hasProvider &&
    targetLocale !== null &&
    model !== null &&
    source.trim() !== "" &&
    !translate.isPending;

  function handleTranslate() {
    if (
      effectiveProviderId === null ||
      targetLocale === null ||
      model === null ||
      source.trim() === ""
    ) {
      return;
    }
    translate.mutate(
      { providerId: effectiveProviderId, model, text: source, locale: targetLocale },
      { onSuccess: ({ text }) => onTranslated(text) },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        <span>Translation provider</span>
        <select
          aria-label="Translation provider"
          className="rounded border border-gray-300 px-2 py-1"
          value={effectiveProviderId ?? ""}
          onChange={(e) => onProviderChange(e.target.value || null)}
        >
          <option value="">Select a provider</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        <span>Translate</span>
        <textarea
          aria-label="Translate"
          className="min-h-20 rounded border border-gray-300 px-2 py-1 disabled:bg-gray-100 disabled:text-gray-400"
          placeholder={
            hasProvider
              ? "Enter text in any language to translate into Phrase…"
              : "Select a translation provider first"
          }
          value={source}
          disabled={!hasProvider}
          onChange={(e) => onSourceChange(e.target.value)}
        />
      </label>

      <button
        type="button"
        className="w-fit rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40"
        disabled={!canTranslate}
        onClick={handleTranslate}
      >
        {translate.isPending ? "Translating…" : "Translate into Phrase"}
      </button>

      {hasProvider && targetLocale === null ? (
        <p className="text-xs text-gray-500">
          Select a Standard locale to set the target language.
        </p>
      ) : null}

      {translate.isError ? (
        <p className="text-sm text-red-600">
          {translate.error instanceof ApiError
            ? translate.error.message
            : "Translation failed."}
        </p>
      ) : null}
    </div>
  );
}
