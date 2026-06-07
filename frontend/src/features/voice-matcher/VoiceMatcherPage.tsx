import { useEffect, useRef, useState } from "react";
import { useGeminiVoices } from "./api/queries.ts";
import { LocaleSelector } from "./components/LocaleSelector.tsx";
import { ReferencePicker } from "./components/ReferencePicker.tsx";
import { ResultsList } from "./components/ResultsList.tsx";
import { TextInput } from "./components/TextInput.tsx";
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

const DEFAULT_MODEL = "gemini-2.5-flash-preview-tts";
const CONCURRENCY = 3;

export function VoiceMatcherPage() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [locale, setLocale] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: geminiVoices } = useGeminiVoices(model);
  const selectedVoice = (geminiVoices ?? []).find((v) => v.id === voiceId);
  const referenceGender: ReferenceGender | null =
    selectedVoice?.gender === "male" || selectedVoice?.gender === "female"
      ? selectedVoice.gender
      : null;

  const { locales, candidates } = useStandardCandidates(
    locale,
    referenceGender,
  );

  const { results, start, reset } = useBatchSynthesis(CONCURRENCY);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset the batch whenever any synthesis input changes.
  useEffect(() => {
    reset();
    setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, voiceId, locale, text]);

  function play(url: string) {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = url;
    void audioRef.current.play();
  }

  function playAll() {
    if (!voiceId) return;
    const order = [voiceId, ...candidates.map((c) => c.id)];
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
    const jobs: SynthesisJob[] = [
      {
        key: voiceId,
        run: (signal) => synthesizeReference(voiceId, text, model, signal),
      },
      ...candidates.map<SynthesisJob>((c) => ({
        key: c.id,
        run: (signal) => synthesizeCandidate(c.id, text, signal),
      })),
    ];
    setSubmitted(true);
    start(jobs);
  }

  const canSubmit =
    voiceId !== null && locale !== null && text.trim() !== "";

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
          model={model}
          voiceId={voiceId}
          onModelChange={(m) => {
            setModel(m);
            setVoiceId(null);
          }}
          onVoiceChange={setVoiceId}
        />
        <LocaleSelector locales={locales} value={locale} onChange={setLocale} />
        <TextInput value={text} onChange={setText} />

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
          referenceLabel={voiceId}
          candidateLabels={candidates.map((c) => c.id)}
          results={results}
          onPlay={play}
          onPlayAll={playAll}
        />
      ) : null}
    </div>
  );
}
