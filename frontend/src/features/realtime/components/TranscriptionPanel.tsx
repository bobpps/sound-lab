import { useEffect, useRef } from "react";
import clsx from "clsx";
import type { TranscriptEntry } from "../hooks/useRealtimeSession.ts";

interface TranscriptionPanelProps {
  error: string | null;
  isConnected: boolean;
  transcriptControls?: React.ReactNode;
  transcripts: TranscriptEntry[];
}

function getRoleLabel(role: TranscriptEntry["role"]): string {
  if (role === "assistant") {
    return "Agent";
  }

  if (role === "user") {
    return "You";
  }

  return "System";
}

export function TranscriptionPanel({
  error,
  isConnected,
  transcriptControls,
  transcripts,
}: TranscriptionPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [transcripts]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Transcription</h2>
          <p className="mt-1 text-sm text-gray-600">
            Live transcript events from the active realtime websocket session.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {transcriptControls}

          <span
            className={clsx(
              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
              isConnected
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-600",
            )}
          >
            {isConnected ? "Live" : "Waiting"}
          </span>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1"
      >
        {transcripts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            {isConnected
              ? "The session is live. Waiting for transcript events..."
              : "Start a session to stream microphone audio and collect transcripts."}
          </div>
        ) : (
          transcripts.map((transcript) => (
            <article
              key={transcript.id}
              className={clsx(
                "rounded-xl border px-4 py-3",
                transcript.role === "user" &&
                  "border-blue-200 bg-blue-50 text-blue-950",
                transcript.role === "assistant" &&
                  "border-gray-200 bg-gray-50 text-gray-900",
                transcript.role === "system" &&
                  "border-amber-200 bg-amber-50 text-amber-900",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-75">
                  {getRoleLabel(transcript.role)}
                </span>
                <span className="text-xs opacity-60">
                  {transcript.final ? "Final" : "Streaming"}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {transcript.text}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
