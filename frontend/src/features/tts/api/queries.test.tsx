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
  useProviderList,
  useDialogList,
  useDialogDetail,
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
});
