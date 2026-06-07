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
import type { RealtimeConnectConfig } from "../hooks/useRealtimeSession.ts";

type SessionConfigExtras = Pick<
  RealtimeConnectConfig,
  "geminiModelSettings" | "geminiTranscriptMode"
>;

interface RealtimeProviderTabProps {
  // PCM rate the microphone capture is resampled to before streaming. OpenAI
  // Realtime requires 24 kHz; other providers accept the 16 kHz default.
  inputSampleRate?: number;
  languageMode?: "auto-only" | "configurable";
  modelFilter?: (models: string[]) => string[];
  modelSettingsControls?: (params: {
    disabled: boolean;
    model: string;
  }) => React.ReactNode;
  promptProviderId?: string;
  providerId: string;
  providerLabel: string;
  sessionConfigExtras?: Partial<SessionConfigExtras> | ((model: string) => Partial<SessionConfigExtras>);
  systemPromptSuffix?: string;
  transcriptControls?: React.ReactNode;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function RealtimeProviderTab({
  inputSampleRate,
  languageMode = "configurable",
  modelFilter,
  modelSettingsControls,
  promptProviderId,
  providerId,
  providerLabel,
  sessionConfigExtras,
  systemPromptSuffix,
  transcriptControls,
}: RealtimeProviderTabProps) {
  const [selectedModel, setSelectedModel] = useState("");
  const resolvedPromptProviderId = promptProviderId ?? providerId;
  const promptsQuery = useAgentPrompts(resolvedPromptProviderId);
  const createPrompt = useCreateAgentPrompt();
  const updatePrompt = useUpdateAgentPrompt();
  const deletePrompt = useDeleteAgentPrompt();
  const modelsQuery = useRealtimeModels(providerId);
  const models = modelFilter ? modelFilter(modelsQuery.data ?? []) : modelsQuery.data ?? [];
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
      provider_id: resolvedPromptProviderId,
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
    const systemPrompt = systemPromptSuffix
      ? `${config.systemPrompt.trim()}\n\n${systemPromptSuffix}`
      : config.systemPrompt;
    const resolvedSessionConfigExtras =
      typeof sessionConfigExtras === "function"
        ? sessionConfigExtras(config.model)
        : sessionConfigExtras;

    await session.connect({
      ...config,
      systemPrompt,
      ...resolvedSessionConfigExtras,
    });

    try {
      await startMicrophone({
        onChunk: session.sendAudio,
        targetSampleRate: inputSampleRate,
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

      {modelSettingsControls?.({
        disabled: session.isConnected || session.isConnecting,
        model: resolvedModel,
      })}

      <TranscriptionPanel
        error={microphoneError ?? session.error}
        isConnected={session.isConnected}
        transcriptControls={transcriptControls}
        transcripts={session.transcripts}
      />
    </div>
  );
}
