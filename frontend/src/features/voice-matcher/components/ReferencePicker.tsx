import type { Voice } from "../../../types/api.ts";
import { useGeminiVoices } from "../api/queries.ts";

const REFERENCE_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-3.1-flash-tts-preview",
] as const;

interface ReferencePickerProps {
  model: string;
  voiceId: string | null;
  onModelChange: (model: string) => void;
  onVoiceChange: (voiceId: string) => void;
}

export function ReferencePicker({
  model,
  voiceId,
  onModelChange,
  onVoiceChange,
}: ReferencePickerProps) {
  const { data, isLoading, isError } = useGeminiVoices(model);
  const voices: Voice[] = data ?? [];
  const selected = voices.find((v) => v.id === voiceId);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        <span>Reference model</span>
        <select
          aria-label="Reference model"
          className="rounded border border-gray-300 px-2 py-1"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {REFERENCE_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

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
