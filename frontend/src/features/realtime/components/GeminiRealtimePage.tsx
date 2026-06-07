import { useEffect, useState } from "react";
import { GeminiTab } from "./GeminiTab.tsx";
import type { RealtimeConnectConfig } from "../hooks/useRealtimeSession.ts";

const SPOKEN_RESPONSE_ONLY_PROMPT =
  "Think through the best response internally, but output only the final spoken response to the user. Do not include reasoning, headings, labels, markdown, explanations of intent, or translations.";
const GEMINI_25_SETTINGS_STORAGE_KEY =
  "sound-lab:realtime-gemini:settings:gemini-2.5-flash-native-audio";
const GEMINI_31_SETTINGS_STORAGE_KEY =
  "sound-lab:realtime-gemini:settings:gemini-3.1-flash-live";
const THINKING_BUDGET_MAX = 24_576;
const THINKING_BUDGET_STEP = 256;
const turnCoverageOptions = [
  "TURN_INCLUDES_ONLY_ACTIVITY",
  "TURN_INCLUDES_ALL_INPUT",
  "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
] as const;
const thinkingLevelOptions = ["minimal", "low", "medium", "high"] as const;

type GeminiModelSettings = RealtimeConnectConfig["geminiModelSettings"];
type GeminiTurnCoverage = NonNullable<
  NonNullable<GeminiModelSettings>["realtimeInputConfig"]
>["turnCoverage"];
type GeminiThinkingLevel = NonNullable<
  NonNullable<GeminiModelSettings>["thinkingConfig"]
>["thinkingLevel"];

interface Gemini25SettingsState {
  affectiveDialog: boolean;
  affectiveDialogEnabled: boolean;
  proactiveAudio: boolean;
  proactiveAudioEnabled: boolean;
  thinkingBudget: number;
  thinkingBudgetEnabled: boolean;
  turnCoverage: GeminiTurnCoverage;
  turnCoverageEnabled: boolean;
}

interface Gemini31SettingsState {
  includeThoughts: boolean;
  includeThoughtsEnabled: boolean;
  thinkingLevel: GeminiThinkingLevel;
  thinkingLevelEnabled: boolean;
  turnCoverage: GeminiTurnCoverage;
  turnCoverageEnabled: boolean;
}

const defaultGemini25Settings: Gemini25SettingsState = {
  affectiveDialog: true,
  affectiveDialogEnabled: false,
  proactiveAudio: true,
  proactiveAudioEnabled: false,
  thinkingBudget: 1_024,
  thinkingBudgetEnabled: false,
  turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY",
  turnCoverageEnabled: false,
};

const defaultGemini31Settings: Gemini31SettingsState = {
  includeThoughts: true,
  includeThoughtsEnabled: false,
  thinkingLevel: "minimal",
  thinkingLevelEnabled: false,
  turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
  turnCoverageEnabled: false,
};

function keepFirstAndLastModel(models: string[]): string[] {
  if (models.length <= 2) {
    return models;
  }

  return [models[0], models[models.length - 1]];
}

function getGeminiModelFamily(model: string): "2.5" | "3.1" | null {
  if (model.includes("gemini-2.5-flash-native-audio")) {
    return "2.5";
  }

  if (model.includes("gemini-3.1-flash-live")) {
    return "3.1";
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTurnCoverage(value: unknown): value is GeminiTurnCoverage {
  return turnCoverageOptions.some((option) => option === value);
}

function isThinkingLevel(value: unknown): value is GeminiThinkingLevel {
  return thinkingLevelOptions.some((option) => option === value);
}

function formatTurnCoverage(option: GeminiTurnCoverage): string {
  switch (option) {
    case "TURN_INCLUDES_ONLY_ACTIVITY":
      return "Only activity";
    case "TURN_INCLUDES_ALL_INPUT":
      return "All input";
    case "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO":
      return "Audio activity and all video";
  }
}

function readStoredSettings<TSettings>(
  key: string,
  defaults: TSettings,
  normalize: (
    value: Record<string, unknown>,
    defaults: TSettings,
  ) => TSettings,
): TSettings {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return defaults;
    }

    return normalize(parsed, defaults);
  } catch {
    return defaults;
  }
}

function writeStoredSettings(key: string, settings: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // Ignore storage failures; settings persistence is optional.
  }
}

function normalizeGemini25Settings(
  value: Record<string, unknown>,
  defaults: Gemini25SettingsState,
): Gemini25SettingsState {
  return {
    affectiveDialog: typeof value.affectiveDialog === "boolean"
      ? value.affectiveDialog
      : defaults.affectiveDialog,
    affectiveDialogEnabled: typeof value.affectiveDialogEnabled === "boolean"
      ? value.affectiveDialogEnabled
      : defaults.affectiveDialogEnabled,
    proactiveAudio: typeof value.proactiveAudio === "boolean"
      ? value.proactiveAudio
      : defaults.proactiveAudio,
    proactiveAudioEnabled: typeof value.proactiveAudioEnabled === "boolean"
      ? value.proactiveAudioEnabled
      : defaults.proactiveAudioEnabled,
    thinkingBudget: typeof value.thinkingBudget === "number"
      ? Math.min(THINKING_BUDGET_MAX, Math.max(0, value.thinkingBudget))
      : defaults.thinkingBudget,
    thinkingBudgetEnabled: typeof value.thinkingBudgetEnabled === "boolean"
      ? value.thinkingBudgetEnabled
      : defaults.thinkingBudgetEnabled,
    turnCoverage: isTurnCoverage(value.turnCoverage)
      ? value.turnCoverage
      : defaults.turnCoverage,
    turnCoverageEnabled: typeof value.turnCoverageEnabled === "boolean"
      ? value.turnCoverageEnabled
      : defaults.turnCoverageEnabled,
  };
}

function normalizeGemini31Settings(
  value: Record<string, unknown>,
  defaults: Gemini31SettingsState,
): Gemini31SettingsState {
  return {
    includeThoughts: typeof value.includeThoughts === "boolean"
      ? value.includeThoughts
      : defaults.includeThoughts,
    includeThoughtsEnabled: typeof value.includeThoughtsEnabled === "boolean"
      ? value.includeThoughtsEnabled
      : defaults.includeThoughtsEnabled,
    thinkingLevel: isThinkingLevel(value.thinkingLevel)
      ? value.thinkingLevel
      : defaults.thinkingLevel,
    thinkingLevelEnabled: typeof value.thinkingLevelEnabled === "boolean"
      ? value.thinkingLevelEnabled
      : defaults.thinkingLevelEnabled,
    turnCoverage: isTurnCoverage(value.turnCoverage)
      ? value.turnCoverage
      : defaults.turnCoverage,
    turnCoverageEnabled: typeof value.turnCoverageEnabled === "boolean"
      ? value.turnCoverageEnabled
      : defaults.turnCoverageEnabled,
  };
}

function SettingSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      className={[
        "inline-flex items-center gap-2 text-sm font-medium transition",
        disabled ? "cursor-not-allowed opacity-60" : "text-gray-700",
      ].join(" ")}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span
        className={[
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-gray-200",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
      {label}
    </button>
  );
}

function SettingRow({
  control,
  switchControl,
}: {
  control: React.ReactNode;
  switchControl: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0">
      {switchControl}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {control}
      </div>
    </div>
  );
}

function buildGemini25ModelSettings(settings: Gemini25SettingsState): GeminiModelSettings {
  const modelSettings: NonNullable<GeminiModelSettings> = {};

  if (settings.thinkingBudgetEnabled) {
    modelSettings.thinkingConfig = {
      thinkingBudget: settings.thinkingBudget,
    };
  }

  if (settings.proactiveAudioEnabled) {
    modelSettings.proactivity = {
      proactiveAudio: settings.proactiveAudio,
    };
  }

  if (settings.affectiveDialogEnabled) {
    modelSettings.enableAffectiveDialog = settings.affectiveDialog;
  }

  if (settings.turnCoverageEnabled) {
    modelSettings.realtimeInputConfig = {
      turnCoverage: settings.turnCoverage,
    };
  }

  return Object.keys(modelSettings).length > 0 ? modelSettings : undefined;
}

function buildGemini31ModelSettings(settings: Gemini31SettingsState): GeminiModelSettings {
  const modelSettings: NonNullable<GeminiModelSettings> = {};

  if (settings.thinkingLevelEnabled || settings.includeThoughtsEnabled) {
    modelSettings.thinkingConfig = {};

    if (settings.thinkingLevelEnabled) {
      modelSettings.thinkingConfig.thinkingLevel = settings.thinkingLevel;
    }

    if (settings.includeThoughtsEnabled) {
      modelSettings.thinkingConfig.includeThoughts = settings.includeThoughts;
    }
  }

  if (settings.turnCoverageEnabled) {
    modelSettings.realtimeInputConfig = {
      turnCoverage: settings.turnCoverage,
    };
  }

  return Object.keys(modelSettings).length > 0 ? modelSettings : undefined;
}

export function GeminiRealtimePage() {
  const [transcriptMode, setTranscriptMode] =
    useState<RealtimeConnectConfig["geminiTranscriptMode"]>("live");
  const [spokenResponseOnly, setSpokenResponseOnly] = useState(false);
  const [gemini25Settings, setGemini25Settings] = useState<Gemini25SettingsState>(
    () => readStoredSettings(
      GEMINI_25_SETTINGS_STORAGE_KEY,
      defaultGemini25Settings,
      normalizeGemini25Settings,
    ),
  );
  const [gemini31Settings, setGemini31Settings] = useState<Gemini31SettingsState>(
    () => readStoredSettings(
      GEMINI_31_SETTINGS_STORAGE_KEY,
      defaultGemini31Settings,
      normalizeGemini31Settings,
    ),
  );

  useEffect(() => {
    writeStoredSettings(GEMINI_25_SETTINGS_STORAGE_KEY, gemini25Settings);
  }, [gemini25Settings]);

  useEffect(() => {
    writeStoredSettings(GEMINI_31_SETTINGS_STORAGE_KEY, gemini31Settings);
  }, [gemini31Settings]);

  function buildSessionConfigExtras(model: string) {
    const modelFamily = getGeminiModelFamily(model);
    const geminiModelSettings = modelFamily === "2.5"
      ? buildGemini25ModelSettings(gemini25Settings)
      : modelFamily === "3.1"
        ? buildGemini31ModelSettings(gemini31Settings)
        : undefined;

    return {
      ...(geminiModelSettings ? { geminiModelSettings } : {}),
      geminiTranscriptMode: transcriptMode,
    };
  }

  function renderModelSettings(model: string, disabled: boolean) {
    const modelFamily = getGeminiModelFamily(model);

    if (!modelFamily) {
      return null;
    }

    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">
            Model Settings
          </h2>
          <p className="text-sm text-gray-600">
            Enabled settings are sent with the next Gemini session start.
          </p>
        </div>

        {modelFamily === "2.5" ? (
          <div className="mt-5">
            <SettingRow
              switchControl={
                <SettingSwitch
                  checked={gemini25Settings.thinkingBudgetEnabled}
                  disabled={disabled}
                  label="thinkingConfig.thinkingBudget"
                  onChange={(checked) => {
                    setGemini25Settings((current) => ({
                      ...current,
                      thinkingBudgetEnabled: checked,
                    }));
                  }}
                />
              }
              control={
                <>
                  <input
                    type="range"
                    min={0}
                    max={THINKING_BUDGET_MAX}
                    step={THINKING_BUDGET_STEP}
                    value={gemini25Settings.thinkingBudget}
                    disabled={disabled || !gemini25Settings.thinkingBudgetEnabled}
                    className="w-56 max-w-full"
                    onChange={(event) => {
                      setGemini25Settings((current) => ({
                        ...current,
                        thinkingBudget: Number(event.target.value),
                      }));
                    }}
                  />
                  <span className="w-16 text-right text-sm text-gray-600">
                    {gemini25Settings.thinkingBudget}
                  </span>
                </>
              }
            />

            <SettingRow
              switchControl={
                <SettingSwitch
                  checked={gemini25Settings.proactiveAudioEnabled}
                  disabled={disabled}
                  label="proactivity.proactiveAudio"
                  onChange={(checked) => {
                    setGemini25Settings((current) => ({
                      ...current,
                      proactiveAudioEnabled: checked,
                    }));
                  }}
                />
              }
              control={
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-gray-900"
                    checked={gemini25Settings.proactiveAudio}
                    disabled={disabled || !gemini25Settings.proactiveAudioEnabled}
                    onChange={(event) => {
                      setGemini25Settings((current) => ({
                        ...current,
                        proactiveAudio: event.target.checked,
                      }));
                    }}
                  />
                  Value
                </label>
              }
            />

            <SettingRow
              switchControl={
                <SettingSwitch
                  checked={gemini25Settings.affectiveDialogEnabled}
                  disabled={disabled}
                  label="enableAffectiveDialog"
                  onChange={(checked) => {
                    setGemini25Settings((current) => ({
                      ...current,
                      affectiveDialogEnabled: checked,
                    }));
                  }}
                />
              }
              control={
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-gray-900"
                    checked={gemini25Settings.affectiveDialog}
                    disabled={disabled || !gemini25Settings.affectiveDialogEnabled}
                    onChange={(event) => {
                      setGemini25Settings((current) => ({
                        ...current,
                        affectiveDialog: event.target.checked,
                      }));
                    }}
                  />
                  Value
                </label>
              }
            />

            <SettingRow
              switchControl={
                <SettingSwitch
                  checked={gemini25Settings.turnCoverageEnabled}
                  disabled={disabled}
                  label="turnCoverage"
                  onChange={(checked) => {
                    setGemini25Settings((current) => ({
                      ...current,
                      turnCoverageEnabled: checked,
                    }));
                  }}
                />
              }
              control={
                <select
                  className="w-72 max-w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={gemini25Settings.turnCoverage}
                  disabled={disabled || !gemini25Settings.turnCoverageEnabled}
                  onChange={(event) => {
                    setGemini25Settings((current) => ({
                      ...current,
                      turnCoverage: event.target.value as GeminiTurnCoverage,
                    }));
                  }}
                >
                  {turnCoverageOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatTurnCoverage(option)}
                    </option>
                  ))}
                </select>
              }
            />
          </div>
        ) : (
          <div className="mt-5">
            <SettingRow
              switchControl={
                <SettingSwitch
                  checked={gemini31Settings.thinkingLevelEnabled}
                  disabled={disabled}
                  label="thinkingConfig.thinkingLevel"
                  onChange={(checked) => {
                    setGemini31Settings((current) => ({
                      ...current,
                      thinkingLevelEnabled: checked,
                    }));
                  }}
                />
              }
              control={
                <select
                  className="w-72 max-w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={gemini31Settings.thinkingLevel}
                  disabled={disabled || !gemini31Settings.thinkingLevelEnabled}
                  onChange={(event) => {
                    setGemini31Settings((current) => ({
                      ...current,
                      thinkingLevel: event.target.value as GeminiThinkingLevel,
                    }));
                  }}
                >
                  {thinkingLevelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              }
            />

            <SettingRow
              switchControl={
                <SettingSwitch
                  checked={gemini31Settings.includeThoughtsEnabled}
                  disabled={disabled}
                  label="thinkingConfig.includeThoughts"
                  onChange={(checked) => {
                    setGemini31Settings((current) => ({
                      ...current,
                      includeThoughtsEnabled: checked,
                    }));
                  }}
                />
              }
              control={
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-gray-900"
                    checked={gemini31Settings.includeThoughts}
                    disabled={disabled || !gemini31Settings.includeThoughtsEnabled}
                    onChange={(event) => {
                      setGemini31Settings((current) => ({
                        ...current,
                        includeThoughts: event.target.checked,
                      }));
                    }}
                  />
                  Value
                </label>
              }
            />

            <SettingRow
              switchControl={
                <SettingSwitch
                  checked={gemini31Settings.turnCoverageEnabled}
                  disabled={disabled}
                  label="turnCoverage"
                  onChange={(checked) => {
                    setGemini31Settings((current) => ({
                      ...current,
                      turnCoverageEnabled: checked,
                    }));
                  }}
                />
              }
              control={
                <select
                  className="w-72 max-w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={gemini31Settings.turnCoverage}
                  disabled={disabled || !gemini31Settings.turnCoverageEnabled}
                  onChange={(event) => {
                    setGemini31Settings((current) => ({
                      ...current,
                      turnCoverage: event.target.value as GeminiTurnCoverage,
                    }));
                  }}
                >
                  {turnCoverageOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatTurnCoverage(option)}
                    </option>
                  ))}
                </select>
              }
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Realtime Gemini</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Dedicated Gemini realtime workspace for testing model behavior,
          voices, prompts, microphone capture, audio playback, and transcript
          handling.
        </p>
      </div>

      <GeminiTab
        modelFilter={keepFirstAndLastModel}
        modelSettingsControls={({ disabled, model }) =>
          renderModelSettings(model, disabled)
        }
        promptProviderId="gemini-realtime"
        providerId="gemini-realtime-sdk"
        sessionConfigExtras={buildSessionConfigExtras}
        systemPromptSuffix={
          spokenResponseOnly ? SPOKEN_RESPONSE_ONLY_PROMPT : undefined
        }
        transcriptMode={transcriptMode}
        transcriptControls={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-gray-900"
                checked={transcriptMode === "final"}
                onChange={(event) => {
                  setTranscriptMode(event.target.checked ? "final" : "live");
                }}
              />
              Final phrases only
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-gray-900"
                checked={spokenResponseOnly}
                onChange={(event) => {
                  setSpokenResponseOnly(event.target.checked);
                }}
              />
              Spoken response only
            </label>
          </div>
        }
      />
    </div>
  );
}
