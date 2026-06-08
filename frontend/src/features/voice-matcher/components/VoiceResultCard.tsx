import clsx from "clsx";
import type { SynthesisResult } from "../hooks/useBatchSynthesis.ts";

interface VoiceResultCardProps {
  label: string;
  result: SynthesisResult | undefined;
  onPlay: (url: string) => void;
  highlighted?: boolean;
}

export function VoiceResultCard({
  label,
  result,
  onPlay,
  highlighted = false,
}: VoiceResultCardProps) {
  const status = result?.status ?? "pending";
  const canPlay = status === "done" && result?.url !== undefined;

  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 rounded border px-3 py-2",
        highlighted ? "border-blue-400 bg-blue-50" : "border-gray-200",
      )}
    >
      <span className="font-mono text-sm text-gray-800">{label}</span>

      <div className="flex items-center gap-3">
        {status === "pending" ? (
          <span className="text-xs text-gray-500">Synthesizing…</span>
        ) : null}
        {status === "error" ? (
          <span className="text-xs text-red-600">{result?.error}</span>
        ) : null}
        <button
          type="button"
          className="rounded bg-gray-800 px-3 py-1 text-xs text-white disabled:opacity-40"
          disabled={!canPlay}
          onClick={() => {
            if (result?.url) onPlay(result.url);
          }}
        >
          Play
        </button>
      </div>
    </div>
  );
}
