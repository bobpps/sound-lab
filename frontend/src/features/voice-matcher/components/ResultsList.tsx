import type { ResultMap } from "../hooks/useBatchSynthesis.ts";
import { VoiceResultCard } from "./VoiceResultCard.tsx";

interface ResultsListProps {
  referenceLabel: string;
  candidateLabels: string[];
  results: ResultMap;
  onPlay: (url: string) => void;
  onPlayAll: () => void;
  isRunning: boolean;
}

export function ResultsList({
  referenceLabel,
  candidateLabels,
  results,
  onPlay,
  onPlayAll,
  isRunning,
}: ResultsListProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Results</h2>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40"
          onClick={onPlayAll}
          // While the batch runs, some cards have no URL yet; playAll snapshots
          // the ready URLs once, so late finishers would be skipped. Disable
          // until the batch settles.
          disabled={isRunning}
        >
          Play all in sequence
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase text-gray-500">
          Reference
        </p>
        <VoiceResultCard
          label={referenceLabel}
          result={results[referenceLabel]}
          onPlay={onPlay}
          highlighted
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase text-gray-500">
          Candidates
        </p>
        {candidateLabels.length === 0 ? (
          <p className="text-sm text-gray-500">
            No Standard voices match this locale and gender.
          </p>
        ) : (
          candidateLabels.map((label) => (
            <VoiceResultCard
              key={label}
              label={label}
              result={results[label]}
              onPlay={onPlay}
            />
          ))
        )}
      </div>
    </div>
  );
}
