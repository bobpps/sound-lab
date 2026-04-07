# TTS Voice Assignment + Audio Playback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TTS page stub with a functional page that lets users select a provider, dialog, and annotation, assign voices to each character, then play the dialog line-by-line with visual highlighting.

**Architecture:** Feature-based structure under `frontend/src/features/tts/`. The page has three sections: (1) a selector panel with provider/dialog/annotation dropdowns that drive all downstream state, (2) a voice assignment panel mapping each character (1 | 2) to a voice fetched from the selected TTS provider, (3) a playback panel that synthesizes each annotated message sequentially via `POST /api/tts/:providerId/synthesize`, plays the returned audio blob, and highlights the active line. All state is local (React `useState`) — nothing is persisted. AbortController cancels in-flight synthesis requests on stop/unmount.

**Tech Stack:** React 19, TanStack Query, Tailwind CSS, Vitest + React Testing Library, TypeScript (ESM, `.ts` extensions in frontend imports)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/features/tts/api/queries.ts` | TanStack Query hooks: `useTtsVoices`, `useAnnotations`, `useAnnotation`, `useProviderList`, `useDialogList`, `useDialogDetail` |
| Create | `frontend/src/features/tts/api/queries.test.tsx` | Tests for the query hooks |
| Create | `frontend/src/features/tts/hooks/useAudioPlayback.ts` | Sequential audio playback hook: synthesize + play + highlight |
| Create | `frontend/src/features/tts/hooks/useAudioPlayback.test.ts` | Tests for the playback hook |
| Create | `frontend/src/features/tts/components/VoiceAssignment.tsx` | Two dropdowns mapping character 1 and character 2 to a voice |
| Create | `frontend/src/features/tts/components/VoiceAssignment.test.tsx` | Tests for VoiceAssignment |
| Create | `frontend/src/features/tts/components/PlaybackControls.tsx` | Run/Stop buttons + progress indicator |
| Create | `frontend/src/features/tts/components/PlaybackControls.test.tsx` | Tests for PlaybackControls |
| Create | `frontend/src/features/tts/components/TtsPage.tsx` | Full page: selectors + voice assignment + message list with highlighting + playback controls |
| Create | `frontend/src/features/tts/components/TtsPage.test.tsx` | Integration tests for the TtsPage |
| Modify | `frontend/src/router.tsx:6` | Update import from `pages/TtsPage.tsx` to `features/tts/components/TtsPage.tsx` |
| Delete | `frontend/src/pages/TtsPage.tsx` | Remove the stub (after router update) |

---

### Task 1: TTS Query Hooks

**Files:**
- Create: `frontend/src/features/tts/api/queries.ts`
- Create: `frontend/src/features/tts/api/queries.test.tsx`

- [ ] **Step 1: Create the test file with all test cases**

Create `frontend/src/features/tts/api/queries.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestQueryClient,
  createTestWrapper,
} from "../../../test-utils.tsx";
import {
  useTtsVoices,
  useAnnotations,
  useAnnotation,
  ttsVoiceKeys,
  annotationKeys,
} from "./queries.ts";

const voices = [
  {
    id: "voice-1",
    name: "Alice",
    language: "en-US",
    gender: "female",
  },
  {
    id: "voice-2",
    name: "Bob",
    language: "en-US",
    gender: "male",
  },
];

const annotations = [
  {
    id: 1,
    dialog_id: 10,
    provider_id: "google",
    title: "Narration v1",
    created_by: null,
    created_at: "2026-04-03T10:00:00.000Z",
  },
];

const annotationWithMessages = {
  id: 1,
  dialog_id: 10,
  provider_id: "google",
  title: "Narration v1",
  created_by: null,
  created_at: "2026-04-03T10:00:00.000Z",
  messages: [
    { id: 100, annotated_dialog_id: 1, dialog_message_id: 50, text: "Hello there." },
    { id: 101, annotated_dialog_id: 1, dialog_message_id: 51, text: "Hi, how are you?" },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname + input.search;
  return input.url;
}

describe("tts queries", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url === "/api/tts/google/voices") {
          return jsonResponse(voices);
        }

        if (url === "/api/dialogs/10/annotations") {
          return jsonResponse(annotations);
        }

        if (url === "/api/annotations/1") {
          return jsonResponse(annotationWithMessages);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches voices for a TTS provider", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsVoices("google"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(voices);
    expect(queryClient.getQueryData(ttsVoiceKeys.list("google"))).toEqual(voices);
  });

  it("does not fetch voices when providerId is null", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsVoices(null), { wrapper });

    expect(result.current.isFetching).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches annotations for a dialog", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotations(10), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(annotations);
    expect(fetch).toHaveBeenCalledWith(
      "/api/dialogs/10/annotations",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not fetch annotations when dialogId is null", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotations(null), { wrapper });

    expect(result.current.isFetching).toBe(false);
  });

  it("fetches an annotation with messages", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotation(1), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(annotationWithMessages);
    expect(result.current.data?.messages).toHaveLength(2);
  });

  it("does not fetch annotation when annotationId is null", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotation(null), { wrapper });

    expect(result.current.isFetching).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/tts/api/queries.test.tsx`
Expected: FAIL — cannot resolve `./queries.ts`

- [ ] **Step 3: Implement the query hooks**

Create `frontend/src/features/tts/api/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.ts";
import type {
  AnnotatedDialog,
  AnnotatedDialogWithMessages,
  Voice,
} from "../../../types/api.ts";

export const ttsVoiceKeys = {
  all: ["tts-voices"] as const,
  list: (providerId: string) => [...ttsVoiceKeys.all, providerId] as const,
};

export const annotationKeys = {
  all: ["annotations"] as const,
  byDialog: (dialogId: number) =>
    [...annotationKeys.all, "dialog", dialogId] as const,
  detail: (annotationId: number) =>
    [...annotationKeys.all, "detail", annotationId] as const,
};

export function useTtsVoices(providerId: string | null) {
  return useQuery({
    queryKey: ttsVoiceKeys.list(providerId ?? ""),
    queryFn: () => api.get<Voice[]>(`/tts/${providerId}/voices`),
    enabled: providerId !== null,
  });
}

export function useAnnotations(dialogId: number | null) {
  return useQuery({
    queryKey: annotationKeys.byDialog(dialogId ?? 0),
    queryFn: () =>
      api.get<AnnotatedDialog[]>(`/dialogs/${dialogId}/annotations`),
    enabled: dialogId !== null,
  });
}

export function useAnnotation(annotationId: number | null) {
  return useQuery({
    queryKey: annotationKeys.detail(annotationId ?? 0),
    queryFn: () =>
      api.get<AnnotatedDialogWithMessages>(`/annotations/${annotationId}`),
    enabled: annotationId !== null,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/tts/api/queries.test.tsx`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/api/queries.ts frontend/src/features/tts/api/queries.test.tsx
git commit -m "feat(tts): add TanStack Query hooks for voices and annotations"
```

---

### Task 2: Audio Playback Hook

**Files:**
- Create: `frontend/src/features/tts/hooks/useAudioPlayback.ts`
- Create: `frontend/src/features/tts/hooks/useAudioPlayback.test.ts`

- [ ] **Step 1: Create the test file**

Create `frontend/src/features/tts/hooks/useAudioPlayback.test.ts`:

```ts
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

    vi.stubGlobal("Audio", vi.fn(() => mockAudio.instance));

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
      useAudioPlayback({ providerId: "google", messages, voiceMap, synthesize: synthesizeFn }),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.currentIndex).toBe(-1);
  });

  it("starts playback and sets status to playing", async () => {
    const { result } = renderHook(() =>
      useAudioPlayback({ providerId: "google", messages, voiceMap, synthesize: synthesizeFn }),
    );

    await act(async () => {
      result.current.play();
    });

    expect(result.current.status).toBe("playing");
    expect(result.current.currentIndex).toBe(0);
    expect(synthesizeFn).toHaveBeenCalledWith("google", "voice-alice", "Hello there.", expect.any(AbortSignal));
  });

  it("advances to next message when audio ends", async () => {
    const { result } = renderHook(() =>
      useAudioPlayback({ providerId: "google", messages, voiceMap, synthesize: synthesizeFn }),
    );

    await act(async () => {
      result.current.play();
    });

    expect(result.current.currentIndex).toBe(0);

    await act(async () => {
      mockAudio.triggerEnded();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(synthesizeFn).toHaveBeenCalledWith("google", "voice-bob", "Hi, how are you?", expect.any(AbortSignal));
  });

  it("stops playback and resets state", async () => {
    const { result } = renderHook(() =>
      useAudioPlayback({ providerId: "google", messages, voiceMap, synthesize: synthesizeFn }),
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
        messages,
        voiceMap,
        synthesize: synthesizeFn,
      }),
    );

    expect(result.current.canPlay).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/tts/hooks/useAudioPlayback.test.ts`
Expected: FAIL — cannot resolve `./useAudioPlayback.ts`

- [ ] **Step 3: Implement the playback hook**

Create `frontend/src/features/tts/hooks/useAudioPlayback.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/tts/hooks/useAudioPlayback.test.ts`
Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/hooks/useAudioPlayback.ts frontend/src/features/tts/hooks/useAudioPlayback.test.ts
git commit -m "feat(tts): add useAudioPlayback hook with sequential synthesis and blob cleanup"
```

---

### Task 3: VoiceAssignment Component

**Files:**
- Create: `frontend/src/features/tts/components/VoiceAssignment.tsx`
- Create: `frontend/src/features/tts/components/VoiceAssignment.test.tsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/features/tts/components/VoiceAssignment.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import type { Voice } from "../../../types/api.ts";
import type { VoiceMap } from "../hooks/useAudioPlayback.ts";
import { VoiceAssignment } from "./VoiceAssignment.tsx";

const voices: Voice[] = [
  { id: "voice-1", name: "Alice", language: "en-US", gender: "female" },
  { id: "voice-2", name: "Bob", language: "en-US", gender: "male" },
  { id: "voice-3", name: "Charlie", language: "en-US" },
];

describe("VoiceAssignment", () => {
  it("renders two dropdowns for character 1 and character 2", () => {
    const onChange = vi.fn();

    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={{}}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Character 1 voice")).toBeInTheDocument();
    expect(screen.getByLabelText("Character 2 voice")).toBeInTheDocument();
  });

  it("shows voice options in each dropdown", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={{}}
        onChange={onChange}
      />,
    );

    const select1 = screen.getByLabelText("Character 1 voice");
    await user.selectOptions(select1, "voice-1");

    expect(onChange).toHaveBeenCalledWith({ 1: "voice-1" });
  });

  it("calls onChange for character 2 selection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={{ 1: "voice-1" }}
        onChange={onChange}
      />,
    );

    const select2 = screen.getByLabelText("Character 2 voice");
    await user.selectOptions(select2, "voice-2");

    expect(onChange).toHaveBeenCalledWith({ 1: "voice-1", 2: "voice-2" });
  });

  it("reflects the current voiceMap in select values", () => {
    const voiceMap: VoiceMap = { 1: "voice-1", 2: "voice-2" };

    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={voiceMap}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Character 1 voice")).toHaveValue("voice-1");
    expect(screen.getByLabelText("Character 2 voice")).toHaveValue("voice-2");
  });

  it("shows empty state when no voices are provided", () => {
    renderWithProviders(
      <VoiceAssignment
        voices={[]}
        voiceMap={{}}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/no voices available/i)).toBeInTheDocument();
  });

  it("disables dropdowns when disabled prop is true", () => {
    renderWithProviders(
      <VoiceAssignment
        voices={voices}
        voiceMap={{}}
        onChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByLabelText("Character 1 voice")).toBeDisabled();
    expect(screen.getByLabelText("Character 2 voice")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/tts/components/VoiceAssignment.test.tsx`
Expected: FAIL — cannot resolve `./VoiceAssignment.tsx`

- [ ] **Step 3: Implement VoiceAssignment**

Create `frontend/src/features/tts/components/VoiceAssignment.tsx`:

```tsx
import type { Voice } from "../../../types/api.ts";
import type { VoiceMap } from "../hooks/useAudioPlayback.ts";

interface VoiceAssignmentProps {
  voices: Voice[];
  voiceMap: VoiceMap;
  onChange: (voiceMap: VoiceMap) => void;
  disabled?: boolean;
}

const CHARACTERS = [1, 2] as const;

export function VoiceAssignment({
  voices,
  voiceMap,
  onChange,
  disabled = false,
}: VoiceAssignmentProps) {
  if (voices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
        No voices available for this provider.
      </div>
    );
  }

  function handleChange(character: 1 | 2, voiceId: string) {
    const next = { ...voiceMap };

    if (voiceId === "") {
      delete next[character];
    } else {
      next[character] = voiceId;
    }

    onChange(next);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CHARACTERS.map((character) => (
        <label
          key={character}
          className="flex flex-col gap-1 text-sm text-gray-600"
        >
          Character {character} voice
          <select
            aria-label={`Character ${character} voice`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            value={voiceMap[character] ?? ""}
            onChange={(e) => handleChange(character, e.target.value)}
            disabled={disabled}
          >
            <option value="">Select a voice...</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
                {voice.gender ? ` (${voice.gender})` : ""}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/tts/components/VoiceAssignment.test.tsx`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/components/VoiceAssignment.tsx frontend/src/features/tts/components/VoiceAssignment.test.tsx
git commit -m "feat(tts): add VoiceAssignment component with character-to-voice mapping"
```

---

### Task 4: PlaybackControls Component

**Files:**
- Create: `frontend/src/features/tts/components/PlaybackControls.tsx`
- Create: `frontend/src/features/tts/components/PlaybackControls.test.tsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/features/tts/components/PlaybackControls.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { PlaybackControls } from "./PlaybackControls.tsx";

describe("PlaybackControls", () => {
  it("renders Run button when idle", () => {
    renderWithProviders(
      <PlaybackControls
        status="idle"
        currentIndex={-1}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  it("renders Stop button when playing", () => {
    renderWithProviders(
      <PlaybackControls
        status="playing"
        currentIndex={2}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run/i })).not.toBeInTheDocument();
  });

  it("shows progress when playing", () => {
    renderWithProviders(
      <PlaybackControls
        status="playing"
        currentIndex={2}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByText("3 / 5")).toBeInTheDocument();
  });

  it("calls onPlay when Run button is clicked", async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <PlaybackControls
        status="idle"
        currentIndex={-1}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={onPlay}
        onStop={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /run/i }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("calls onStop when Stop button is clicked", async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <PlaybackControls
        status="playing"
        currentIndex={0}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={vi.fn()}
        onStop={onStop}
      />,
    );

    await user.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("disables Run button when canPlay is false", () => {
    renderWithProviders(
      <PlaybackControls
        status="idle"
        currentIndex={-1}
        totalMessages={5}
        canPlay={false}
        error={null}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });

  it("shows error message when in error state", () => {
    renderWithProviders(
      <PlaybackControls
        status="error"
        currentIndex={-1}
        totalMessages={5}
        canPlay
        error="Network error"
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/tts/components/PlaybackControls.test.tsx`
Expected: FAIL — cannot resolve `./PlaybackControls.tsx`

- [ ] **Step 3: Implement PlaybackControls**

Create `frontend/src/features/tts/components/PlaybackControls.tsx`:

```tsx
import type { PlaybackStatus } from "../hooks/useAudioPlayback.ts";

interface PlaybackControlsProps {
  status: PlaybackStatus;
  currentIndex: number;
  totalMessages: number;
  canPlay: boolean;
  error: string | null;
  onPlay: () => void;
  onStop: () => void;
}

export function PlaybackControls({
  status,
  currentIndex,
  totalMessages,
  canPlay,
  error,
  onPlay,
  onStop,
}: PlaybackControlsProps) {
  const isPlaying = status === "playing";

  return (
    <div className="flex flex-wrap items-center gap-4">
      {isPlaying ? (
        <button
          type="button"
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          onClick={onStop}
        >
          Stop
        </button>
      ) : (
        <button
          type="button"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onPlay}
          disabled={!canPlay}
        >
          Run
        </button>
      )}

      {isPlaying && (
        <span className="text-sm text-gray-600">
          {currentIndex + 1} / {totalMessages}
        </span>
      )}

      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/tts/components/PlaybackControls.test.tsx`
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tts/components/PlaybackControls.tsx frontend/src/features/tts/components/PlaybackControls.test.tsx
git commit -m "feat(tts): add PlaybackControls component with run/stop and progress"
```

---

### Task 5: TtsPage Component

**Files:**
- Create: `frontend/src/features/tts/components/TtsPage.tsx`
- Create: `frontend/src/features/tts/components/TtsPage.test.tsx`
- Modify: `frontend/src/router.tsx:6`
- Delete: `frontend/src/pages/TtsPage.tsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/features/tts/components/TtsPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { TtsPage } from "./TtsPage.tsx";

const ttsProviders = [
  { id: "google", name: "Google", type: "tts" as const, enabled: true, created_at: "2026-04-03T09:00:00.000Z" },
  { id: "elevenlabs", name: "ElevenLabs", type: "tts" as const, enabled: true, created_at: "2026-04-03T09:00:00.000Z" },
];

const dialogs = [
  { id: 10, title: "Greeting dialog", description: null, language: "en-US", created_by: null, created_at: "2026-04-03T10:00:00.000Z" },
];

const annotations = [
  { id: 1, dialog_id: 10, provider_id: "google", title: "Narration v1", created_by: null, created_at: "2026-04-03T10:00:00.000Z" },
];

const annotationWithMessages = {
  ...annotations[0],
  messages: [
    { id: 100, annotated_dialog_id: 1, dialog_message_id: 50, text: "Hello there." },
    { id: 101, annotated_dialog_id: 1, dialog_message_id: 51, text: "Hi, how are you?" },
  ],
};

const dialogWithMessages = {
  ...dialogs[0],
  messages: [
    { id: 50, dialog_id: 10, order: 1, character: 1 as const, text: "Hello there." },
    { id: 51, dialog_id: 10, order: 2, character: 2 as const, text: "Hi, how are you?" },
  ],
};

const voices = [
  { id: "voice-1", name: "Alice", language: "en-US", gender: "female" },
  { id: "voice-2", name: "Bob", language: "en-US", gender: "male" },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname + input.search;
  return input.url;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = extractUrl(input);

      if (url === "/api/providers?type=tts") return jsonResponse(ttsProviders);
      if (url === "/api/dialogs") return jsonResponse(dialogs);
      if (url === "/api/dialogs/10/annotations") return jsonResponse(annotations);
      if (url === "/api/annotations/1") return jsonResponse(annotationWithMessages);
      if (url === "/api/dialogs/10") return jsonResponse(dialogWithMessages);
      if (url === "/api/tts/google/voices") return jsonResponse(voices);
      if (url === "/api/tts/elevenlabs/voices") return jsonResponse(voices);

      return jsonResponse({ message: "Not Found" }, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TtsPage", () => {
  it("renders the page title and description", async () => {
    renderWithProviders(<TtsPage />);

    expect(screen.getByRole("heading", { name: /tts testing/i })).toBeInTheDocument();
    expect(screen.getByText(/test text-to-speech/i)).toBeInTheDocument();
  });

  it("loads and shows TTS provider options", async () => {
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    const providerSelect = screen.getByLabelText(/provider/i);
    expect(providerSelect).toBeInTheDocument();
  });

  it("shows dialog dropdown after provider is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/provider/i), "google");

    await waitFor(() => {
      expect(screen.getByLabelText(/dialog/i)).toBeInTheDocument();
    });
  });

  it("shows annotation dropdown after dialog is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/provider/i), "google");

    await waitFor(() => {
      expect(screen.getByLabelText(/dialog/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/dialog/i), "10");

    await waitFor(() => {
      expect(screen.getByLabelText(/annotation/i)).toBeInTheDocument();
    });
  });

  it("shows voice assignment and messages after annotation is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/provider/i), "google");

    await waitFor(() => {
      expect(screen.getByLabelText(/dialog/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/dialog/i), "10");

    await waitFor(() => {
      expect(screen.getByLabelText(/annotation/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/annotation/i), "1");

    await waitFor(() => {
      expect(screen.getByText("Hello there.")).toBeInTheDocument();
      expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Character 1 voice")).toBeInTheDocument();
    expect(screen.getByLabelText("Character 2 voice")).toBeInTheDocument();
  });

  it("shows Run button disabled until voices are assigned", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/provider/i), "google");

    await waitFor(() => {
      expect(screen.getByLabelText(/dialog/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/dialog/i), "10");

    await waitFor(() => {
      expect(screen.getByLabelText(/annotation/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/annotation/i), "1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/tts/components/TtsPage.test.tsx`
Expected: FAIL — cannot resolve `./TtsPage.tsx` (importing from features/tts)

- [ ] **Step 3: Implement TtsPage**

Create `frontend/src/features/tts/components/TtsPage.tsx`:

```tsx
import { useState } from "react";
import clsx from "clsx";
import { api } from "../../../lib/api-client.ts";
import type { AnnotatedMessage } from "../../../types/api.ts";
import {
  useAnnotation,
  useAnnotations,
  useDialogDetail,
  useDialogList,
  useProviderList,
  useTtsVoices,
} from "../api/queries.ts";
import {
  useAudioPlayback,
  type PlaybackMessage,
  type VoiceMap,
} from "../hooks/useAudioPlayback.ts";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { VoiceAssignment } from "./VoiceAssignment.tsx";

async function synthesize(
  providerId: string,
  voiceId: string,
  text: string,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await api.fetchRaw(`/tts/${providerId}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voiceId, text }),
    signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }

  return response.blob();
}

function buildPlaybackMessages(
  annotatedMessages: AnnotatedMessage[],
  dialogMessages: Array<{ id: number; character: 1 | 2 }>,
): PlaybackMessage[] {
  const characterByMessageId = new Map(
    dialogMessages.map((m) => [m.id, m.character]),
  );

  return annotatedMessages.map((am) => ({
    id: am.id,
    character: characterByMessageId.get(am.dialog_message_id) ?? 1,
    text: am.text,
  }));
}

export function TtsPage() {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
  const [voiceMap, setVoiceMap] = useState<VoiceMap>({});

  const providersQuery = useProviderList();
  const dialogsQuery = useDialogList();
  const voicesQuery = useTtsVoices(selectedProviderId);
  const annotationsQuery = useAnnotations(selectedDialogId);
  const annotationQuery = useAnnotation(selectedAnnotationId);
  const dialogDetailQuery = useDialogDetail(selectedDialogId);

  const playbackMessages: PlaybackMessage[] =
    annotationQuery.data?.messages && dialogDetailQuery.data?.messages
      ? buildPlaybackMessages(
          annotationQuery.data.messages,
          dialogDetailQuery.data.messages,
        )
      : [];

  const playback = useAudioPlayback({
    providerId: selectedProviderId,
    messages: playbackMessages,
    voiceMap,
    synthesize,
  });

  function handleProviderChange(value: string) {
    setSelectedProviderId(value || null);
    setSelectedAnnotationId(null);
    setVoiceMap({});
    playback.stop();
  }

  function handleDialogChange(value: string) {
    const id = Number(value);
    setSelectedDialogId(Number.isNaN(id) ? null : id);
    setSelectedAnnotationId(null);
    playback.stop();
  }

  function handleAnnotationChange(value: string) {
    const id = Number(value);
    setSelectedAnnotationId(Number.isNaN(id) ? null : id);
    playback.stop();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">TTS Testing</h1>
        <p className="mt-2 text-gray-600">
          Test text-to-speech providers and compare outputs.
        </p>
      </div>

      {/* Selectors */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Provider
            <select
              aria-label="Provider"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={selectedProviderId ?? ""}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              <option value="">Select a provider...</option>
              {providersQuery.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Dialog
            <select
              aria-label="Dialog"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={selectedDialogId ?? ""}
              onChange={(e) => handleDialogChange(e.target.value)}
              disabled={!selectedProviderId}
            >
              <option value="">Select a dialog...</option>
              {dialogsQuery.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Annotation
            <select
              aria-label="Annotation"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={selectedAnnotationId ?? ""}
              onChange={(e) => handleAnnotationChange(e.target.value)}
              disabled={!selectedDialogId}
            >
              <option value="">Select an annotation...</option>
              {annotationsQuery.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Voice Assignment — shown when provider + annotation are selected */}
      {selectedProviderId && selectedAnnotationId && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Voice Assignment
          </h2>
          <div className="mt-4">
            {voicesQuery.isPending ? (
              <p className="text-sm text-gray-600">Loading voices...</p>
            ) : voicesQuery.isError ? (
              <p className="text-sm text-red-600">Failed to load voices.</p>
            ) : (
              <VoiceAssignment
                voices={voicesQuery.data ?? []}
                voiceMap={voiceMap}
                onChange={setVoiceMap}
                disabled={playback.status === "playing"}
              />
            )}
          </div>
        </div>
      )}

      {/* Messages + Playback — shown when annotation is loaded */}
      {annotationQuery.data?.messages && annotationQuery.data.messages.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Dialog Lines
            </h2>
            <PlaybackControls
              status={playback.status}
              currentIndex={playback.currentIndex}
              totalMessages={playbackMessages.length}
              canPlay={playback.canPlay}
              error={playback.error}
              onPlay={playback.play}
              onStop={playback.stop}
            />
          </div>

          <div className="mt-4 space-y-2">
            {playbackMessages.map((message, index) => (
              <div
                key={message.id}
                className={clsx(
                  "rounded-xl border px-4 py-3 text-sm transition",
                  playback.currentIndex === index
                    ? "border-blue-300 bg-blue-50 text-blue-900"
                    : "border-gray-200 bg-gray-50 text-gray-700",
                )}
              >
                <span className="font-medium text-gray-500">
                  Character {message.character}:
                </span>{" "}
                {message.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Important:** This step requires `useProviderList`, `useDialogList`, and `useDialogDetail` hooks that don't exist in the Task 1 version of `queries.ts`. Step 3a below adds them.

- [ ] **Step 3a: Extend queries.ts with provider and dialog hooks**

To avoid cross-feature imports from `features/datasets/`, add these hooks to `frontend/src/features/tts/api/queries.ts`. They use the same query keys as the datasets feature, so TanStack Query deduplicates network requests. Append the following to the existing `queries.ts`:

```ts
// Re-declared here to avoid cross-feature imports.
// Uses the same query keys as datasets, so TanStack Query deduplicates requests.

export function useProviderList() {
  return useQuery({
    queryKey: ["providers", "tts"],
    queryFn: () => api.get<Provider[]>("/providers?type=tts"),
  });
}

export function useDialogList() {
  return useQuery({
    queryKey: ["dialogs", "list"],
    queryFn: () => api.get<Dialog[]>("/dialogs"),
  });
}

export function useDialogDetail(dialogId: number | null) {
  return useQuery({
    queryKey: ["dialogs", "detail", dialogId ?? 0],
    queryFn: () => api.get<DialogWithMessages>(`/dialogs/${dialogId}`),
    enabled: dialogId !== null,
  });
}
```

Also update the imports at the top of `queries.ts` to include the new types:

```ts
import type {
  AnnotatedDialog,
  AnnotatedDialogWithMessages,
  Dialog,
  DialogWithMessages,
  Provider,
  Voice,
} from "../../../types/api.ts";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/tts/components/TtsPage.test.tsx`
Expected: all 6 tests PASS

- [ ] **Step 5: Update the queries test to cover new hooks**

Add tests for `useProviderList`, `useDialogList`, and `useDialogDetail` to `frontend/src/features/tts/api/queries.test.tsx`. Update the import from `./queries.ts` to include `useProviderList`, `useDialogList`, and `useDialogDetail`. Then add the following to the `beforeEach` fetch stub:

```tsx
if (url === "/api/providers?type=tts") {
  return jsonResponse([
    { id: "google", name: "Google", type: "tts", enabled: true, created_at: "2026-04-03T09:00:00.000Z" },
  ]);
}

if (url === "/api/dialogs") {
  return jsonResponse([
    { id: 10, title: "Test dialog", description: null, language: "en-US", created_by: null, created_at: "2026-04-03T10:00:00.000Z" },
  ]);
}

if (url === "/api/dialogs/10") {
  return jsonResponse({
    id: 10, title: "Test dialog", description: null, language: "en-US", created_by: null, created_at: "2026-04-03T10:00:00.000Z",
    messages: [
      { id: 50, dialog_id: 10, order: 1, character: 1, text: "Hello." },
    ],
  });
}
```

Add these test cases:

```tsx
it("fetches TTS providers", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useProviderList(), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data).toHaveLength(1);
  expect(result.current.data?.[0].id).toBe("google");
});

it("fetches dialog list", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useDialogList(), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data).toHaveLength(1);
  expect(result.current.data?.[0].title).toBe("Test dialog");
});

it("fetches dialog detail with messages", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useDialogDetail(10), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data?.messages).toHaveLength(1);
});

it("does not fetch dialog detail when dialogId is null", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  const { result } = renderHook(() => useDialogDetail(null), { wrapper });

  expect(result.current.isFetching).toBe(false);
});
```

- [ ] **Step 6: Run all TTS tests to verify**

Run: `cd frontend && npx vitest run src/features/tts/`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/tts/api/queries.ts frontend/src/features/tts/api/queries.test.tsx frontend/src/features/tts/components/TtsPage.tsx frontend/src/features/tts/components/TtsPage.test.tsx
git commit -m "feat(tts): add TtsPage with selectors, voice assignment, and playback"
```

---

### Task 6: Router Update + Stub Cleanup

**Files:**
- Modify: `frontend/src/router.tsx:6`
- Delete: `frontend/src/pages/TtsPage.tsx`

- [ ] **Step 1: Update the router import**

In `frontend/src/router.tsx`, change line 6 from:

```tsx
import { TtsPage } from "./pages/TtsPage.tsx";
```

to:

```tsx
import { TtsPage } from "./features/tts/components/TtsPage.tsx";
```

- [ ] **Step 2: Delete the stub**

```bash
rm frontend/src/pages/TtsPage.tsx
```

- [ ] **Step 3: Run existing router tests**

Run: `cd frontend && npx vitest run src/router.test.tsx`
Expected: PASS — existing tests should still work

- [ ] **Step 4: Run ALL frontend tests**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Build to verify no TypeScript errors**

Run: `cd frontend && npx tsc -b`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/router.tsx
git rm frontend/src/pages/TtsPage.tsx
git commit -m "feat(tts): wire TtsPage into router and remove stub"
```

---

### Task 7: Visual Verification with Playwright

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (in the project root)
Expected: backend on port 3000, frontend on port 5173

- [ ] **Step 2: Open the TTS page in Playwright browser**

Navigate to `http://localhost:5173/tts`

- [ ] **Step 3: Take a screenshot and verify**

Verify:
- Page title "TTS Testing" is visible
- Provider dropdown is visible and populated (if providers are configured)
- Selecting a provider enables the Dialog dropdown
- Selecting a dialog shows the Annotation dropdown
- Selecting an annotation shows voice assignment dropdowns and message list
- The Run button appears disabled until both voices are assigned
- No console errors or warnings

- [ ] **Step 4: Check browser console**

Open the browser console and verify no errors or warnings.

- [ ] **Step 5: Close the dev server**

Stop the dev server.
