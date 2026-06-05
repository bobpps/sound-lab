import { RealtimeProviderTab } from "./RealtimeProviderTab.tsx";

export function OpenAiTab() {
  return (
    <RealtimeProviderTab
      inputSampleRate={24_000}
      providerId="openai-realtime"
      providerLabel="OpenAI"
    />
  );
}
