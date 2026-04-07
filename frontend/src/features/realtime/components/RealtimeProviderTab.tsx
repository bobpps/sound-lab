import { useEffect } from "react";
import {
  useCreateAgentPrompt,
  useAgentPrompts,
  useRealtimeModels,
} from "../api/queries.ts";
import { useMicrophone } from "../hooks/useMicrophone.ts";
import { useRealtimeSession } from "../hooks/useRealtimeSession.ts";
import {
  SessionControls,
  type CreatePromptDraft,
} from "./SessionControls.tsx";
import { TranscriptionPanel } from "./TranscriptionPanel.tsx";

interface RealtimeProviderTabProps {
  providerId: string;
  providerLabel: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function RealtimeProviderTab({
  providerId,
  providerLabel,
}: RealtimeProviderTabProps) {
  const promptsQuery = useAgentPrompts(providerId);
  const createPrompt = useCreateAgentPrompt();
  const modelsQuery = useRealtimeModels(providerId);
  const {
    error: microphoneError,
    isRecording,
    start: startMicrophone,
    stop: stopMicrophone,
  } = useMicrophone();
  const session = useRealtimeSession(providerId);

  useEffect(() => {
    if (!session.isConnected && isRecording) {
      stopMicrophone();
    }
  }, [isRecording, session.isConnected, stopMicrophone]);

  async function handleCreatePrompt(draft: CreatePromptDraft) {
    return createPrompt.mutateAsync({
      language: draft.language,
      prompt: draft.prompt,
      provider_id: providerId,
      title: draft.title,
    });
  }

  async function handleStart(config: {
    model: string;
    systemPrompt: string;
    voice?: string;
  }) {
    await session.connect(config);

    try {
      await startMicrophone({
        onChunk: session.sendAudio,
      });
    } catch (error) {
      await session.disconnect();
      throw error;
    }
  }

  async function handleStop() {
    stopMicrophone();
    await session.disconnect();
  }

  return (
    <div className="space-y-6">
      <SessionControls
        error={microphoneError ?? session.error}
        isActive={session.isConnected}
        isBusy={session.isConnecting || createPrompt.isPending}
        isCreatingPrompt={createPrompt.isPending}
        isModelsLoading={modelsQuery.isPending}
        isPromptsLoading={promptsQuery.isPending}
        models={modelsQuery.data ?? []}
        modelsError={
          modelsQuery.isError
            ? getErrorMessage(modelsQuery.error, "Unable to load realtime models.")
            : null
        }
        prompts={promptsQuery.data ?? []}
        promptsError={
          promptsQuery.isError
            ? getErrorMessage(promptsQuery.error, "Unable to load agent prompts.")
            : null
        }
        providerLabel={providerLabel}
        onCreatePrompt={handleCreatePrompt}
        onStart={handleStart}
        onStop={handleStop}
      />

      <TranscriptionPanel
        error={microphoneError ?? session.error}
        isConnected={session.isConnected}
        transcripts={session.transcripts}
      />
    </div>
  );
}
