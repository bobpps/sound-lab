import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_REFERENCE_MODEL,
  REFERENCE_MODELS,
  useGeminiVoices,
} from "./api/queries.ts";
import { LocaleSelector } from "./components/LocaleSelector.tsx";
import { ReferencePicker } from "./components/ReferencePicker.tsx";
import { ResultsList } from "./components/ResultsList.tsx";
import { TextInput } from "./components/TextInput.tsx";
import { TranslatePanel } from "./components/TranslatePanel.tsx";
import {
  useStandardCandidates,
  type ReferenceGender,
} from "./hooks/useStandardCandidates.ts";
import {
  useBatchSynthesis,
  type SynthesisJob,
} from "./hooks/useBatchSynthesis.ts";
import {
  synthesizeCandidate,
  synthesizeReference,
} from "./lib/synthesize.ts";
import {
  readStoredForm,
  writeStoredForm,
  type VoiceMatcherFormState,
} from "./lib/storage.ts";

const CONCURRENCY = 3;

const DEFAULT_FORM: VoiceMatcherFormState = {
  voiceId: null,
  locale: null,
  text: "",
  translateProviderId: null,
  translateText: "",
};

export function VoiceMatcherPage() {
  // Read the persisted form once on mount so the page restores the last
  // entered values when the user navigates back to it.
  const [initial] = useState(() => readStoredForm(DEFAULT_FORM));
  const [voiceId, setVoiceId] = useState<string | null>(initial.voiceId);
  const [locale, setLocale] = useState<string | null>(initial.locale);
  const [text, setText] = useState(initial.text);
  const [translateProviderId, setTranslateProviderId] = useState<string | null>(
    initial.translateProviderId,
  );
  const [translateText, setTranslateText] = useState(initial.translateText);
  const [submitted, setSubmitted] = useState(false);

  // Persist the form on every change so the values survive unmount/navigation.
  useEffect(() => {
    writeStoredForm({
      voiceId,
      locale,
      text,
      translateProviderId,
      translateText,
    });
  }, [voiceId, locale, text, translateProviderId, translateText]);

  // Every reference model exposes the same voices, so load them once from the
  // default model. The chosen voice is synthesized by all models on submit.
  const { data: geminiVoices } = useGeminiVoices(DEFAULT_REFERENCE_MODEL);
  const selectedVoice = (geminiVoices ?? []).find((v) => v.id === voiceId);
  const referenceGender: ReferenceGender | null =
    selectedVoice?.gender === "male" || selectedVoice?.gender === "female"
      ? selectedVoice.gender
      : null;

  const {
    locales,
    candidates,
    isLoading: localesLoading,
    isError: localesError,
  } = useStandardCandidates(locale, referenceGender);

  const { results, isRunning, start, reset } = useBatchSynthesis(CONCURRENCY);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset the batch whenever the user changes a synthesis input. This is done
  // synchronously in the change handlers (not via an effect on the inputs):
  // a deferred reset effect would abort the batch that handleSubmit just
  // started, leaving every card stuck on "Synthesizing…" (the reset would run
  // after start() in the same render commit).
  function resetOutput() {
    reset();
    setSubmitted(false);
  }

  function play(url: string) {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    // Clear any chaining handler left over from a previous "play all" so a
    // single-card play does NOT resume the sequence.
    audioRef.current.onended = null;
    audioRef.current.src = url;
    void audioRef.current.play();
  }

  function playAll() {
    if (!voiceId) return;
    const order = [...REFERENCE_MODELS, ...candidates.map((c) => c.id)];
    const urls = order
      .map((label) => results[label]?.url)
      .filter((u): u is string => u !== undefined);
    if (urls.length === 0) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    let i = 0;
    const playNext = () => {
      if (i >= urls.length) {
        audio.onended = null;
        return;
      }
      audio.src = urls[i++];
      audio.onended = playNext;
      void audio.play();
    };
    playNext();
  }

  function handleSubmit() {
    if (!voiceId || !locale || text.trim() === "") return;
    // Fan the chosen reference voice out across every model — one track each —
    // then append the Standard candidates. Each reference job is keyed by its
    // model so the results map keeps them distinct.
    const referenceJobs = REFERENCE_MODELS.map<SynthesisJob>((m) => ({
      key: m,
      run: (signal) => synthesizeReference(voiceId, text, m, signal),
    }));
    const jobs: SynthesisJob[] = [
      ...referenceJobs,
      ...candidates.map<SynthesisJob>((c) => ({
        key: c.id,
        run: (signal) => synthesizeCandidate(c.id, text, signal),
      })),
    ];
    setSubmitted(true);
    start(jobs);
  }

  const canSubmit =
    voiceId !== null &&
    locale !== null &&
    text.trim() !== "" &&
    !isRunning;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Voice Matcher</h1>

      <div className="grid max-w-xl gap-4">
        <ReferencePicker
          voiceId={voiceId}
          onVoiceChange={(v) => {
            setVoiceId(v);
            resetOutput();
          }}
        />
        <LocaleSelector
          locales={locales}
          value={locale}
          onChange={(l) => {
            setLocale(l);
            resetOutput();
          }}
          isLoading={localesLoading}
          isError={localesError}
        />
        <TranslatePanel
          targetLocale={locale}
          providerId={translateProviderId}
          onProviderChange={setTranslateProviderId}
          source={translateText}
          onSourceChange={setTranslateText}
          onTranslated={(t) => {
            setText(t);
            resetOutput();
          }}
        />
        <TextInput
          value={text}
          onChange={(t) => {
            setText(t);
            resetOutput();
          }}
        />

        <button
          type="button"
          className="w-fit rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Synthesize and compare
        </button>
      </div>

      {submitted && voiceId ? (
        <ResultsList
          referenceLabels={[...REFERENCE_MODELS]}
          candidateLabels={candidates.map((c) => c.id)}
          results={results}
          onPlay={play}
          onPlayAll={playAll}
          isRunning={isRunning}
        />
      ) : null}
    </div>
  );
}
