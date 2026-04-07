import { useEffect, useRef, useState } from "react";

export interface PlaybackMessage {
  id: number;
  character: 1 | 2;
  text: string;
}

export type VoiceMap = Partial<Record<1 | 2, string>>;

export type SynthesizeFn = (
  providerId: string,
  voiceId: string,
  text: string,
  signal: AbortSignal,
) => Promise<Blob>;

export type PlaybackStatus = "idle" | "playing" | "error";

interface UseAudioPlaybackOptions {
  providerId: string | null;
  messages: PlaybackMessage[];
  voiceMap: VoiceMap;
  synthesize: SynthesizeFn;
}

interface UseAudioPlaybackReturn {
  status: PlaybackStatus;
  currentIndex: number;
  error: string | null;
  canPlay: boolean;
  play: () => void;
  stop: () => void;
}

export function useAudioPlayback({
  providerId,
  messages,
  voiceMap,
  synthesize,
}: UseAudioPlaybackOptions): UseAudioPlaybackReturn {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Determine which characters are present in the messages
  const characters = new Set(messages.map((m) => m.character));
  const canPlay =
    providerId !== null &&
    messages.length > 0 &&
    [...characters].every((c) => voiceMap[c] !== undefined);

  function cleanup() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }

  async function playMessage(index: number) {
    if (index >= messages.length) {
      cleanup();
      setStatus("idle");
      setCurrentIndex(-1);
      return;
    }

    const message = messages[index];
    const voiceId = voiceMap[message.character];

    if (!voiceId || !providerId) {
      cleanup();
      setStatus("error");
      setError("Missing voice assignment");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setCurrentIndex(index);

      const blob = await synthesize(
        providerId,
        voiceId,
        message.text,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      // Clean up previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        blobUrlRef.current = null;
        playMessage(index + 1);
      };

      audio.onerror = () => {
        cleanup();
        setStatus("error");
        setError("Audio playback failed");
        setCurrentIndex(-1);
      };

      await audio.play();
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      cleanup();
      setStatus("error");
      setError(err instanceof Error ? err.message : "Synthesis failed");
      setCurrentIndex(-1);
    }
  }

  function play() {
    if (!canPlay) return;

    cleanup();
    setError(null);
    setStatus("playing");
    playMessage(0);
  }

  function stop() {
    cleanup();
    setStatus("idle");
    setCurrentIndex(-1);
    setError(null);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, []);

  return {
    status,
    currentIndex,
    error,
    canPlay,
    play,
    stop,
  };
}
