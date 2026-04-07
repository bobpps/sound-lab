import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestQueryClient,
  createTestWrapper,
} from "../../../test-utils.tsx";
import {
  ttsKeys,
  useTtsProviders,
  useTtsVoices,
  useDialogs,
  useAnnotationsByDialog,
  useAnnotation,
  useDialogDetail,
} from "./queries.ts";

const providers = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    type: "tts",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
  {
    id: "google",
    name: "Google",
    type: "tts",
    enabled: false,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

const voices = [
  {
    id: "voice-1",
    name: "Rachel",
    language: "en-US",
    gender: "female",
  },
];

const dialogs = [
  {
    id: 1,
    title: "Greeting",
    description: null,
    language: "en-US",
    created_by: null,
    created_at: "2026-04-01T10:00:00.000Z",
  },
];

const annotations = [
  {
    id: 10,
    dialog_id: 1,
    provider_id: "openai",
    title: "Formal annotation",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

const annotationWithMessages = {
  id: 10,
  dialog_id: 1,
  provider_id: "openai",
  title: "Formal annotation",
  created_by: null,
  created_at: "2026-04-02T10:00:00.000Z",
  messages: [
    { id: 100, annotated_dialog_id: 10, dialog_message_id: 50, text: "Hello there." },
    { id: 101, annotated_dialog_id: 10, dialog_message_id: 51, text: "Hi, how are you?" },
  ],
};

const dialogWithMessages = {
  ...dialogs[0],
  messages: [
    { id: 50, dialog_id: 1, order: 1, character: 1 as const, text: "Hello." },
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
  if (input instanceof URL) return input.pathname;
  return input.url;
}

describe("tts queries", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(providers);
        }

        if (url.endsWith("/api/tts/elevenlabs/voices")) {
          return jsonResponse(voices);
        }

        if (url.endsWith("/api/dialogs")) {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs/1/annotations")) {
          return jsonResponse(annotations);
        }

        if (url.endsWith("/api/annotations/10")) {
          return jsonResponse(annotationWithMessages);
        }

        if (url.endsWith("/api/dialogs/1") && !url.includes("annotations")) {
          return jsonResponse(dialogWithMessages);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches TTS providers", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsProviders(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(providers);
    expect(fetch).toHaveBeenCalledWith(
      "/api/providers?type=tts",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches voices for a provider", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsVoices("elevenlabs"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(voices);
    expect(fetch).toHaveBeenCalledWith(
      "/api/tts/elevenlabs/voices",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("disables voices query when providerId is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsVoices(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches dialogs", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useDialogs(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(dialogs);
    expect(fetch).toHaveBeenCalledWith(
      "/api/dialogs",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches annotations for a dialog", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotationsByDialog(1), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(annotations);
    expect(fetch).toHaveBeenCalledWith(
      "/api/dialogs/1/annotations",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("disables annotations query when dialogId is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotationsByDialog(null), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("provides structured query keys via ttsKeys", () => {
    expect(ttsKeys.providers()).toEqual(["tts", "providers"]);
    expect(ttsKeys.voices("elevenlabs")).toEqual([
      "tts",
      "voices",
      "elevenlabs",
    ]);
    expect(ttsKeys.dialogs()).toEqual(["tts", "dialogs"]);
    expect(ttsKeys.annotations(1)).toEqual(["tts", "annotations", 1]);
    expect(ttsKeys.annotation(10)).toEqual(["tts", "annotation", 10]);
    expect(ttsKeys.dialogDetail(1)).toEqual(["tts", "dialog-detail", 1]);
  });

  it("fetches a single annotation with messages", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotation(10), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(annotationWithMessages);
    expect(result.current.data?.messages).toHaveLength(2);
  });

  it("disables annotation query when annotationId is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotation(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches dialog detail with messages", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useDialogDetail(1), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.messages).toHaveLength(1);
  });

  it("disables dialog detail query when dialogId is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useDialogDetail(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
