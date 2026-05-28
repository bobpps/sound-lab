import { RealtimeProviderTab } from "./RealtimeProviderTab.tsx";

export function GeminiTab() {
  return (
    <RealtimeProviderTab
      languageMode="auto-only"
      providerId="gemini-realtime"
      providerLabel="Gemini"
    />
  );
}
