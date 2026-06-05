import { useEffect, useState } from "react";
import {
  useCreateAgentPrompt,
  useDeleteAgentPrompt,
  useAgentPrompts,
  useRealtimeModels,
  useRealtimeVoices,
  useUpdateAgentPrompt,
} from "../api/queries.ts";
import { useMicrophone } from "../hooks/useMicrophone.ts";
import { useRealtimeSession } from "../hooks/useRealtimeSession.ts";
import {
  SessionControls,
  type CreatePromptDraft,
  type UpdatePromptDraft,
} from "./SessionControls.tsx";
import { TranscriptionPanel } from "./TranscriptionPanel.tsx";

interface RealtimeProviderTabProps {
  languageMode?: "auto-only" | "configurable";
  providerId: string;
  providerLabel: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function RealtimeProviderTab({
  languageMode = "configurable",
  providerId,
  providerLabel,
}: RealtimeProviderTabProps) {
  const [selectedModel, setSelectedModel] = useState("");
  const promptsQuery = useAgentPrompts(providerId);
  const createPrompt = useCreateAgentPrompt();
  const updatePrompt = useUpdateAgentPrompt();
  const deletePrompt = useDeleteAgentPrompt();
  const modelsQuery = useRealtimeModels(providerId);
  const models = modelsQuery.data ?? [];
  const resolvedModel =
    models.find((model) => model === selectedModel) ?? models[0] ?? "";
  const voicesQuery = useRealtimeVoices(providerId, resolvedModel || null);
  const {
    error: microphoneError,
    isRecording,
    start: startMicrophone,
    stop: stopMicrophone,
  } = useMicrophone();
  const session = useRealtimeSession(providerId);

  useEffect(() => {
    if (!session.isConnected && isRecording) {
      void stopMicrophone();
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

  async function handleUpdatePrompt(promptId: number, draft: UpdatePromptDraft) {
    return updatePrompt.mutateAsync({
      promptId,
      data: {
        language: draft.language,
        prompt: draft.prompt,
        title: draft.title,
      },
    });
  }

  async function handleDeletePrompt(promptId: number) {
    await deletePrompt.mutateAsync({ promptId });
  }

  async function handleStart(config: {
    language?: string;
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
    await stopMicrophone();
    await session.disconnect();
  }

  return (
    <div className="space-y-6">
      <SessionControls
        error={microphoneError ?? session.error}
        isActive={session.isConnected}
        isBusy={
          session.isConnecting ||
          createPrompt.isPending ||
          updatePrompt.isPending ||
          deletePrompt.isPending
        }
        isCreatingPrompt={createPrompt.isPending}
        isDeletingPrompt={deletePrompt.isPending}
        isModelsLoading={modelsQuery.isPending}
        isPromptsLoading={promptsQuery.isPending}
        isUpdatingPrompt={updatePrompt.isPending}
        isVoicesLoading={voicesQuery.isPending}
        models={models}
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
        languageMode={languageMode}
        selectedModel={selectedModel}
        voices={voicesQuery.data ?? []}
        voicesError={
          voicesQuery.isError
            ? getErrorMessage(voicesQuery.error, "Unable to load realtime voices.")
            : null
        }
        onModelChange={setSelectedModel}
        onCreatePrompt={handleCreatePrompt}
        onDeletePrompt={handleDeletePrompt}
        onStart={handleStart}
        onStop={handleStop}
        onUpdatePrompt={handleUpdatePrompt}
      />

      <TranscriptionPanel
        error={microphoneError ?? session.error}
        isConnected={session.isConnected}
        transcripts={session.transcripts}
      />
    </div>
  );
}
