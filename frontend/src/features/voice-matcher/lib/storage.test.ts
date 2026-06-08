import { afterEach, describe, expect, it } from "vitest";
import {
  readStoredForm,
  writeStoredForm,
  type VoiceMatcherFormState,
} from "./storage.ts";

const DEFAULTS: VoiceMatcherFormState = {
  voiceId: null,
  locale: null,
  text: "",
  translateProviderId: null,
  translateText: "",
};

afterEach(() => {
  window.localStorage.clear();
});

describe("voice-matcher form storage", () => {
  it("returns defaults when nothing is stored", () => {
    expect(readStoredForm(DEFAULTS)).toEqual(DEFAULTS);
  });

  it("round-trips a fully populated form", () => {
    const form: VoiceMatcherFormState = {
      voiceId: "Kore",
      locale: "en-US",
      text: "Hello world",
      translateProviderId: "anthropic",
      translateText: "Привет мир",
    };
    writeStoredForm(form);
    expect(readStoredForm(DEFAULTS)).toEqual(form);
  });

  it("round-trips null voiceId and locale", () => {
    const form: VoiceMatcherFormState = {
      voiceId: null,
      locale: null,
      text: "draft",
      translateProviderId: null,
      translateText: "",
    };
    writeStoredForm(form);
    expect(readStoredForm(DEFAULTS)).toEqual(form);
  });

  it("falls back to defaults for fields with the wrong type", () => {
    window.localStorage.setItem(
      "sound-lab:voice-matcher:form",
      JSON.stringify({ voiceId: "Puck", locale: 7, text: null }),
    );
    expect(readStoredForm(DEFAULTS)).toEqual({
      voiceId: "Puck",
      locale: DEFAULTS.locale,
      text: DEFAULTS.text,
      translateProviderId: DEFAULTS.translateProviderId,
      translateText: DEFAULTS.translateText,
    });
  });

  it("returns defaults when the stored value is not valid JSON", () => {
    window.localStorage.setItem("sound-lab:voice-matcher:form", "{not json");
    expect(readStoredForm(DEFAULTS)).toEqual(DEFAULTS);
  });

  it("returns defaults when the stored value is not an object", () => {
    window.localStorage.setItem("sound-lab:voice-matcher:form", "\"a string\"");
    expect(readStoredForm(DEFAULTS)).toEqual(DEFAULTS);
  });
});
