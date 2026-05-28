import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAudioPlayback,
  type PlaybackMessage,
  type VoiceMap,
  type SynthesizeFn,
} from "./useAudioPlayback.ts";

function createMockAudio(): {
  instance: HTMLAudioElement;
  triggerEnded: () => void;
  triggerError: () => void;
} {
  let onEndedHandler: (() => void) | null = null;
  let onErrorHandler: (() => void) | null = null;

  const instance = {
    src: "",
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    set onended(fn: (() => void) | null) {
      onEndedHandler = fn;
    },
    get onended() {
      return onEndedHandler;
    },
    set onerror(fn: (() => void) | null) {
      onErrorHandler = fn;
    },
    get onerror() {
      return onErrorHandler;
    },
  } as unknown as HTMLAudioElement;

  return {
    instance,
    triggerEnded: () => onEndedHandler?.(),
    triggerError: () => onErrorHandler?.(),
  };
}

const messages: PlaybackMessage[] = [
  { id: 100, character: 1 as const, text: "Hello there." },
  { id: 101, character: 2 as const, text: "Hi, how are you?" },
  { id: 102, character: 1 as const, text: "Good, thanks!" },
];

const voiceMap: VoiceMap = {
  1: "voice-alice",
  2: "voice-bob",
};

describe("useAudioPlayback", () => {
  let mockAudio: ReturnType<typeof createMockAudio>;
  let revokedUrls: string[];
  let synthesizeFn: SynthesizeFn;

  beforeEach(() => {
    mockAudio = createMockAudio();
    revokedUrls = [];

    vi.stubGlobal("Audio", vi.fn(function () { return mockAudio.instance; }));

    vi.stubGlobal(
      "URL",
      {
        ...globalThis.URL,
        createObjectURL: vi.fn(() => "blob:mock-url"),
        revokeObjectURL: vi.fn((url: string) => revokedUrls.push(url)),
      },
    );

    synthesizeFn = vi.fn(async () => {
      return new Blob(["audio-data"], { type: "audio/mpeg" });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages,
        voiceMap,
        synthesize: synthesizeFn,
      }),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.currentIndex).toBe(-1);
  });

  it("starts playback and sets status to playing", async () => {
    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages,
        voiceMap,
        synthesize: synthesizeFn,
      }),
    );

    await act(async () => {
      result.current.play();
    });

    expect(result.current.status).toBe("playing");
    expect(result.current.currentIndex).toBe(0);
    expect(synthesizeFn).toHaveBeenCalledWith("google", "Chirp3-HD", "voice-alice", "Hello there.", expect.any(AbortSignal));
  });

  it("advances to next message when audio ends", async () => {
    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages,
        voiceMap,
        synthesize: synthesizeFn,
      }),
    );

    await act(async () => {
      result.current.play();
    });

    expect(result.current.currentIndex).toBe(0);

    await act(async () => {
      mockAudio.triggerEnded();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(synthesizeFn).toHaveBeenCalledWith("google", "Chirp3-HD", "voice-bob", "Hi, how are you?", expect.any(AbortSignal));
  });

  it("stops playback and resets state", async () => {
    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages,
        voiceMap,
        synthesize: synthesizeFn,
      }),
    );

    await act(async () => {
      result.current.play();
    });

    expect(result.current.status).toBe("playing");

    act(() => {
      result.current.stop();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.currentIndex).toBe(-1);
    expect(mockAudio.instance.pause).toHaveBeenCalled();
  });

  it("returns to idle after the last message finishes", async () => {
    const singleMessage: PlaybackMessage[] = [
      { id: 100, character: 1 as const, text: "Only line." },
    ];

    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages: singleMessage,
        voiceMap,
        synthesize: synthesizeFn,
      }),
    );

    await act(async () => {
      result.current.play();
    });

    expect(result.current.status).toBe("playing");

    await act(async () => {
      mockAudio.triggerEnded();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.currentIndex).toBe(-1);
  });

  it("revokes blob URLs when audio ends", async () => {
    const singleMessage: PlaybackMessage[] = [
      { id: 100, character: 1 as const, text: "Only line." },
    ];

    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages: singleMessage,
        voiceMap,
        synthesize: synthesizeFn,
      }),
    );

    await act(async () => {
      result.current.play();
    });

    await act(async () => {
      mockAudio.triggerEnded();
    });

    expect(revokedUrls).toContain("blob:mock-url");
  });

  it("sets error status when synthesis fails", async () => {
    const failingSynthesize: SynthesizeFn = vi.fn(async () => {
      throw new Error("Network error");
    });

    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages,
        voiceMap,
        synthesize: failingSynthesize,
      }),
    );

    await act(async () => {
      result.current.play();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Network error");
  });

  it("does not play when voiceMap is incomplete", () => {
    const incompleteMap: VoiceMap = { 1: "voice-alice" };

    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages,
        voiceMap: incompleteMap,
        synthesize: synthesizeFn,
      }),
    );

    expect(result.current.canPlay).toBe(false);
  });

  it("reports canPlay true when all characters have voices", () => {
    const { result } = renderHook(() =>
      useAudioPlayback({
        providerId: "google",
        model: "Chirp3-HD",
        messages,
        voiceMap,
        synthesize: synthesizeFn,
      }),
    );

    expect(result.current.canPlay).toBe(true);
  });
});
