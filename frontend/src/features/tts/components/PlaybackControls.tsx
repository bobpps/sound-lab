import type { PlaybackStatus } from "../hooks/useAudioPlayback.ts";

interface PlaybackControlsProps {
  status: PlaybackStatus;
  currentIndex: number;
  totalMessages: number;
  canPlay: boolean;
  error: string | null;
  onPlay: () => void;
  onStop: () => void;
}

export function PlaybackControls({
  status,
  currentIndex,
  totalMessages,
  canPlay,
  error,
  onPlay,
  onStop,
}: PlaybackControlsProps) {
  const isPlaying = status === "playing";

  return (
    <div className="flex flex-wrap items-center gap-4">
      {isPlaying ? (
        <button
          type="button"
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          onClick={onStop}
        >
          Stop
        </button>
      ) : (
        <button
          type="button"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onPlay}
          disabled={!canPlay}
        >
          Run
        </button>
      )}

      {isPlaying && (
        <span className="text-sm text-gray-600">
          {currentIndex + 1} / {totalMessages}
        </span>
      )}

      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
    </div>
  );
}
