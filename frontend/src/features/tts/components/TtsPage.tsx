import { useState } from "react";
import clsx from "clsx";
import { api } from "../../../lib/api-client.ts";
import type { AnnotatedMessage, DialogMessage } from "../../../types/api.ts";
import { useAnnotation, useDialogDetail, useTtsVoices } from "../api/queries.ts";
import {
  useAudioPlayback,
  type PlaybackMessage,
  type VoiceMap,
} from "../hooks/useAudioPlayback.ts";
import { AnnotationEditor } from "./AnnotationEditor.tsx";
import { AnnotationSelector } from "./AnnotationSelector.tsx";
import { DialogSelector } from "./DialogSelector.tsx";
import { ModelSelector } from "./ModelSelector.tsx";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { ProviderSelector } from "./ProviderSelector.tsx";
import { VoiceAssignment } from "./VoiceAssignment.tsx";

async function synthesize(
  providerId: string,
  model: string,
  voiceId: string,
  text: string,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await api.fetchRaw(`/tts/${providerId}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voiceId, text, model }),
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

function buildAnnotatedPlaybackMessages(
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

function buildOriginalPlaybackMessages(
  dialogMessages: DialogMessage[],
): PlaybackMessage[] {
  return dialogMessages.map((m) => ({
    id: m.id,
    character: m.character,
    text: m.text,
  }));
}

export function TtsPage() {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );
  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    number | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [voiceMap, setVoiceMap] = useState<VoiceMap>({});

  // Queries for voice assignment + playback
  const voicesQuery = useTtsVoices(selectedProviderId, selectedModel);
  const annotationQuery = useAnnotation(selectedAnnotationId);
  const dialogDetailQuery = useDialogDetail(selectedDialogId);

  // null annotationId means "clean/no annotation" — use original dialog messages
  const useOriginal = selectedAnnotationId === null && selectedDialogId !== null;

  const playbackMessages: PlaybackMessage[] =
    useOriginal && dialogDetailQuery.data?.messages
      ? buildOriginalPlaybackMessages(dialogDetailQuery.data.messages)
      : annotationQuery.data?.messages && dialogDetailQuery.data?.messages
        ? buildAnnotatedPlaybackMessages(
            annotationQuery.data.messages,
            dialogDetailQuery.data.messages,
          )
        : [];

  const playback = useAudioPlayback({
    providerId: selectedProviderId,
    model: selectedModel,
    messages: playbackMessages,
    voiceMap,
    synthesize,
  });

  function handleProviderSelect(providerId: string) {
    setSelectedProviderId(providerId);
    setSelectedDialogId(null);
    setSelectedAnnotationId(null);
    setSelectedModel(null);
    setVoiceMap({});
    playback.stop();
  }

  function handleDialogSelect(dialogId: number) {
    setSelectedDialogId(dialogId);
    setSelectedAnnotationId(null);
    setSelectedModel(null);
    playback.stop();
  }

  function handleAnnotationSelect(annotationId: number | null) {
    setSelectedAnnotationId(annotationId);
    playback.stop();
  }

  function handleModelSelect(model: string) {
    setSelectedModel(model);
    setVoiceMap({});
    playback.stop();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">TTS Testing</h1>
        <p className="max-w-2xl text-sm text-gray-600">
          Test text-to-speech providers and compare outputs.
        </p>
      </div>

      {/* Selectors — from PR #59 components */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-4">
          <ProviderSelector
            selectedId={selectedProviderId}
            onSelect={handleProviderSelect}
          />

          {selectedProviderId !== null && (
            <DialogSelector
              selectedId={selectedDialogId}
              onSelect={handleDialogSelect}
            />
          )}

          {selectedProviderId !== null && selectedDialogId !== null && (
            <ModelSelector
              providerId={selectedProviderId}
              selectedModel={selectedModel}
              onSelect={handleModelSelect}
            />
          )}

          {selectedProviderId !== null && selectedDialogId !== null && (
            <AnnotationSelector
              dialogId={selectedDialogId}
              providerId={selectedProviderId}
              selectedAnnotationId={selectedAnnotationId}
              onSelect={handleAnnotationSelect}
            />
          )}
        </div>
      </div>

      {/* Annotation Editor — shown when an annotation variant is selected */}
      {selectedAnnotationId !== null &&
        selectedDialogId !== null &&
        selectedProviderId !== null && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <AnnotationEditor
              annotationId={selectedAnnotationId}
              dialogId={selectedDialogId}
              ttsProviderId={selectedProviderId}
              onAnnotationCreated={handleAnnotationSelect}
            />
          </div>
        )}

      {/* Voice Assignment — shown after provider + dialog selected */}
      {selectedProviderId && selectedDialogId !== null && selectedModel && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Voice Assignment
          </h2>
          <div className="mt-4">
            {voicesQuery.isPending ? (
              <p className="text-sm text-gray-500">Loading voices...</p>
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

      {/* Messages + Playback */}
      {playbackMessages.length > 0 && (
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
