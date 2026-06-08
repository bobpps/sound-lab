import type { Voice } from "../../../types/api.ts";
import { DEFAULT_REFERENCE_MODEL, useGeminiVoices } from "../api/queries.ts";

interface ReferencePickerProps {
  voiceId: string | null;
  onVoiceChange: (voiceId: string) => void;
}

export function ReferencePicker({
  voiceId,
  onVoiceChange,
}: ReferencePickerProps) {
  // The voice list is identical across every reference model, so load it once
  // from the default model. The chosen voice is synthesized by all models.
  const { data, isLoading, isError } = useGeminiVoices(DEFAULT_REFERENCE_MODEL);
  const voices: Voice[] = data ?? [];
  const selected = voices.find((v) => v.id === voiceId);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        <span>Reference voice</span>
        <select
          aria-label="Reference voice"
          className="rounded border border-gray-300 px-2 py-1"
          value={voiceId ?? ""}
          disabled={isLoading || isError}
          onChange={(e) => onVoiceChange(e.target.value)}
        >
          <option value="" disabled>
            {isLoading ? "Loading…" : "Select a voice"}
          </option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.gender ? ` (${v.gender})` : ""}
            </option>
          ))}
        </select>
      </label>

      {selected?.gender ? (
        <span className="w-fit rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
          {selected.gender}
        </span>
      ) : null}

      {isError ? (
        <p className="text-sm text-red-600">Failed to load reference voices.</p>
      ) : null}
    </div>
  );
}
