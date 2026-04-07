import { useState } from "react";
import clsx from "clsx";
import { api } from "../../../lib/api-client.ts";
import type { AnnotatedMessage } from "../../../types/api.ts";
import {
  useAnnotation,
  useAnnotations,
  useDialogDetail,
  useDialogList,
  useProviderList,
  useTtsVoices,
} from "../api/queries.ts";
import {
  useAudioPlayback,
  type PlaybackMessage,
  type VoiceMap,
} from "../hooks/useAudioPlayback.ts";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { VoiceAssignment } from "./VoiceAssignment.tsx";

async function synthesize(
  providerId: string,
  voiceId: string,
  text: string,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await api.fetchRaw(`/tts/${providerId}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voiceId, text }),
    signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }

  return response.blob();
}

function buildPlaybackMessages(
  annotatedMessages: AnnotatedMessage[],
  dialogMessages: Array<{ id: number; character: 1 | 2 }>,
): PlaybackMessage[] {
  const characterByMessageId = new Map(
    dialogMessages.map((m) => [m.id, m.character]),
  );

  return annotatedMessages.map((am) => ({
    id: am.id,
    character: characterByMessageId.get(am.dialog_message_id) ?? 1,
    text: am.text,
  }));
}

export function TtsPage() {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
  const [voiceMap, setVoiceMap] = useState<VoiceMap>({});

  const providersQuery = useProviderList();
  const dialogsQuery = useDialogList();
  const voicesQuery = useTtsVoices(selectedProviderId);
  const annotationsQuery = useAnnotations(selectedDialogId);
  const annotationQuery = useAnnotation(selectedAnnotationId);
  const dialogDetailQuery = useDialogDetail(selectedDialogId);

  const playbackMessages: PlaybackMessage[] =
    annotationQuery.data?.messages && dialogDetailQuery.data?.messages
      ? buildPlaybackMessages(
          annotationQuery.data.messages,
          dialogDetailQuery.data.messages,
        )
      : [];

  const playback = useAudioPlayback({
    providerId: selectedProviderId,
    messages: playbackMessages,
    voiceMap,
    synthesize,
  });

  function handleProviderChange(value: string) {
    setSelectedProviderId(value || null);
    setSelectedAnnotationId(null);
    setVoiceMap({});
    playback.stop();
  }

  function handleDialogChange(value: string) {
    const id = Number(value);
    setSelectedDialogId(Number.isNaN(id) ? null : id);
    setSelectedAnnotationId(null);
    playback.stop();
  }

  function handleAnnotationChange(value: string) {
    const id = Number(value);
    setSelectedAnnotationId(Number.isNaN(id) ? null : id);
    playback.stop();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">TTS Testing</h1>
        <p className="mt-2 text-gray-600">
          Test text-to-speech providers and compare outputs.
        </p>
      </div>

      {/* Selectors */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Provider
            <select
              aria-label="Provider"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={selectedProviderId ?? ""}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              <option value="">Select a provider...</option>
              {providersQuery.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Dialog
            <select
              aria-label="Dialog"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={selectedDialogId ?? ""}
              onChange={(e) => handleDialogChange(e.target.value)}
              disabled={!selectedProviderId}
            >
              <option value="">Select a dialog...</option>
              {dialogsQuery.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Annotation
            <select
              aria-label="Annotation"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={selectedAnnotationId ?? ""}
              onChange={(e) => handleAnnotationChange(e.target.value)}
              disabled={!selectedDialogId}
            >
              <option value="">Select an annotation...</option>
              {annotationsQuery.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Voice Assignment -- shown when provider + annotation are selected */}
      {selectedProviderId && selectedAnnotationId && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Voice Assignment
          </h2>
          <div className="mt-4">
            {voicesQuery.isPending ? (
              <p className="text-sm text-gray-600">Loading voices...</p>
            ) : voicesQuery.isError ? (
              <p className="text-sm text-red-600">Failed to load voices.</p>
            ) : (
              <VoiceAssignment
                voices={voicesQuery.data ?? []}
                voiceMap={voiceMap}
                onChange={setVoiceMap}
                disabled={playback.status === "playing"}
              />
            )}
          </div>
        </div>
      )}

      {/* Messages + Playback -- shown when annotation is loaded */}
      {annotationQuery.data?.messages && annotationQuery.data.messages.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Dialog Lines
            </h2>
            <PlaybackControls
              status={playback.status}
              currentIndex={playback.currentIndex}
              totalMessages={playbackMessages.length}
              canPlay={playback.canPlay}
              error={playback.error}
              onPlay={playback.play}
              onStop={playback.stop}
            />
          </div>

          <div className="mt-4 space-y-2">
            {playbackMessages.map((message, index) => (
              <div
                key={message.id}
                className={clsx(
                  "rounded-xl border px-4 py-3 text-sm transition",
                  playback.currentIndex === index
                    ? "border-blue-300 bg-blue-50 text-blue-900"
                    : "border-gray-200 bg-gray-50 text-gray-700",
                )}
              >
                <span className="font-medium text-gray-500">
                  Character {message.character}:
                </span>{" "}
                {message.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
