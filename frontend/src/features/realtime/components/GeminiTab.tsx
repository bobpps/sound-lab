import { RealtimeProviderTab } from "./RealtimeProviderTab.tsx";
import type { RealtimeConnectConfig } from "../hooks/useRealtimeSession.ts";

interface GeminiTabProps {
  modelFilter?: (models: string[]) => string[];
  modelSettingsControls?: (params: {
    disabled: boolean;
    model: string;
  }) => React.ReactNode;
  promptProviderId?: string;
  providerId?: string;
  sessionConfigExtras?: (model: string) => Partial<Pick<
    RealtimeConnectConfig,
    "geminiModelSettings" | "geminiTranscriptMode"
  >>;
  systemPromptSuffix?: string;
  transcriptMode?: RealtimeConnectConfig["geminiTranscriptMode"];
  transcriptControls?: React.ReactNode;
}

export function GeminiTab({
  modelFilter,
  modelSettingsControls,
  promptProviderId,
  providerId = "gemini-realtime",
  sessionConfigExtras,
  systemPromptSuffix,
  transcriptControls,
  transcriptMode,
}: GeminiTabProps) {
  return (
    <RealtimeProviderTab
      languageMode="auto-only"
      modelFilter={modelFilter}
      modelSettingsControls={modelSettingsControls}
      promptProviderId={promptProviderId}
      providerId={providerId}
      providerLabel="Gemini"
      sessionConfigExtras={
        sessionConfigExtras ??
        (transcriptMode ? { geminiTranscriptMode: transcriptMode } : undefined)
      }
      systemPromptSuffix={systemPromptSuffix}
      transcriptControls={transcriptControls}
    />
  );
}
