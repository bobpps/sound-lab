import { Tabs } from "../../../components/ui/Tabs.tsx";
import { ElevenLabsTab } from "./ElevenLabsTab.tsx";
import { GeminiTab } from "./GeminiTab.tsx";
import { InworldTab } from "./InworldTab.tsx";
import { OpenAiTab } from "./OpenAiTab.tsx";

type RealtimeProviderTabId = "openai" | "gemini" | "elevenlabs" | "inworld";

const realtimeTabs: ReadonlyArray<{
  id: RealtimeProviderTabId;
  label: string;
}> = [
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Gemini" },
  { id: "elevenlabs", label: "ElevenLabs" },
  { id: "inworld", label: "Inworld" },
];

export function RealtimePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Realtime</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Compare live voice-agent sessions across all supported realtime
          providers. Each tab keeps its own model lookup, agent prompts, session
          controls, microphone capture, and transcript stream.
        </p>
      </div>

      <Tabs defaultTab="openai" tabs={realtimeTabs}>
        {(activeTab) => {
          switch (activeTab) {
            case "gemini":
              return <GeminiTab />;
            case "elevenlabs":
              return <ElevenLabsTab />;
            case "inworld":
              return <InworldTab />;
            case "openai":
            default:
              return <OpenAiTab />;
          }
        }}
      </Tabs>
    </div>
  );
}
