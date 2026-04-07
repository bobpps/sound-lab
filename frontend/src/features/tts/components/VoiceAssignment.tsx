import type { Voice } from "../../../types/api.ts";
import type { VoiceMap } from "../hooks/useAudioPlayback.ts";

interface VoiceAssignmentProps {
  voices: Voice[];
  voiceMap: VoiceMap;
  onChange: (voiceMap: VoiceMap) => void;
  disabled?: boolean;
}

const CHARACTERS = [1, 2] as const;

export function VoiceAssignment({
  voices,
  voiceMap,
  onChange,
  disabled = false,
}: VoiceAssignmentProps) {
  if (voices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
        No voices available for this provider.
      </div>
    );
  }

  function handleChange(character: 1 | 2, voiceId: string) {
    const next = { ...voiceMap };

    if (voiceId === "") {
      delete next[character];
    } else {
      next[character] = voiceId;
    }

    onChange(next);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CHARACTERS.map((character) => (
        <label
          key={character}
          className="flex flex-col gap-1 text-sm text-gray-600"
        >
          Character {character} voice
          <select
            aria-label={`Character ${character} voice`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            value={voiceMap[character] ?? ""}
            onChange={(e) => handleChange(character, e.target.value)}
            disabled={disabled}
          >
            <option value="">Select a voice...</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
                {voice.gender ? ` (${voice.gender})` : ""}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
