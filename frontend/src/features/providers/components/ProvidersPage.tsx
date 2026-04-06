import { Tabs } from "../../../components/ui/Tabs.tsx";
import type { ProviderType } from "../../../types/api.ts";
import { ProviderList } from "./ProviderList.tsx";

const providerTabs = [
  { id: "tts", label: "TTS" },
  { id: "llm", label: "LLM" },
  { id: "realtime", label: "Realtime" },
] as const satisfies ReadonlyArray<{ id: ProviderType; label: string }>;

export function ProvidersPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
        <p className="max-w-2xl text-sm text-gray-600">
          Manage provider availability and store API keys by provider type.
        </p>
      </div>

      <Tabs defaultTab="tts" tabs={providerTabs}>
        {(activeTab) => <ProviderList type={activeTab} />}
      </Tabs>
    </div>
  );
}
