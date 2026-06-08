const STORAGE_KEY = "sound-lab:voice-matcher:form";

export interface VoiceMatcherFormState {
  voiceId: string | null;
  locale: string | null;
  text: string;
  translateProviderId: string | null;
  translateText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalize(
  value: Record<string, unknown>,
  defaults: VoiceMatcherFormState,
): VoiceMatcherFormState {
  return {
    voiceId: typeof value.voiceId === "string" ? value.voiceId : defaults.voiceId,
    locale: typeof value.locale === "string" ? value.locale : defaults.locale,
    text: typeof value.text === "string" ? value.text : defaults.text,
    translateProviderId:
      typeof value.translateProviderId === "string"
        ? value.translateProviderId
        : defaults.translateProviderId,
    translateText:
      typeof value.translateText === "string"
        ? value.translateText
        : defaults.translateText,
  };
}

export function readStoredForm(
  defaults: VoiceMatcherFormState,
): VoiceMatcherFormState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

export function writeStoredForm(form: VoiceMatcherFormState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  } catch {
    // Ignore storage failures; form persistence is optional.
  }
}
