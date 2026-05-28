import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestQueryClient,
  createTestWrapper,
} from "../../../test-utils.tsx";
import {
  ttsKeys,
  useTtsProviders,
  useTtsModels,
  useTtsVoices,
  useDialogs,
  useAnnotationsByDialog,
  useAnnotation,
  useDialogDetail,
  useLlmProviders,
  useLlmModels,
  useAnnotationPrompts,
  useAutoAnnotate,
  useCreateAnnotation,
  useCreateAnnotationMessage,
  useUpdateAnnotatedMessage,
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

const ttsModels = ["eleven_multilingual_v2"];

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

const llmProviders = [
  {
    id: "openai",
    name: "OpenAI",
    type: "llm",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

const llmModels = ["gpt-4o", "gpt-4o-mini"];

const annotationPrompts = [
  {
    id: 1,
    title: "Formal style",
    provider_id: "elevenlabs",
    language: "en-US",
    prompt: "Make it formal",
    created_by: null,
    created_at: "2026-04-03T00:00:00.000Z",
  },
];

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
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = extractUrl(input);
        const method = init?.method ?? "GET";

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(providers);
        }

        if (url.endsWith("/api/tts/elevenlabs/voices")) {
          return jsonResponse(voices);
        }

        if (url.endsWith("/api/tts/elevenlabs/voices?model=eleven_multilingual_v2")) {
          return jsonResponse(voices);
        }

        if (url.endsWith("/api/tts/elevenlabs/models")) {
          return jsonResponse(ttsModels);
        }

        if (url.endsWith("/api/dialogs") && method === "GET") {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs/1/annotations") && method === "GET") {
          return jsonResponse(annotations);
        }

        if (url.endsWith("/api/annotations/10") && method === "GET") {
          return jsonResponse(annotationWithMessages);
        }

        if (url.endsWith("/api/dialogs/1") && !url.includes("annotations") && method === "GET") {
          return jsonResponse(dialogWithMessages);
        }

        if (url.endsWith("/api/providers?type=llm")) {
          return jsonResponse(llmProviders);
        }

        if (url.endsWith("/api/llm/openai/models")) {
          return jsonResponse(llmModels);
        }

        if (url.endsWith("/api/annotation-prompts")) {
          return jsonResponse(annotationPrompts);
        }

        if (url.endsWith("/api/services/annotate") && method === "POST") {
          return jsonResponse({
            ...annotationWithMessages,
            id: 20,
            title: "Auto-annotated",
          });
        }

        if (
          url.match(/\/api\/dialogs\/\d+\/annotations$/) &&
          method === "POST"
        ) {
          const body = JSON.parse(init?.body as string);
          return jsonResponse(
            {
              id: 20,
              dialog_id: 1,
              ...body,
              created_by: null,
              created_at: "2026-04-02T10:00:00.000Z",
            },
            201,
          );
        }

        if (
          url.match(/\/api\/annotations\/\d+\/messages$/) &&
          method === "POST"
        ) {
          const body = JSON.parse(init?.body as string);
          return jsonResponse(
            { id: 200, annotated_dialog_id: 10, ...body },
            201,
          );
        }

        if (
          url.match(/\/api\/annotations\/\d+\/messages\/\d+/) &&
          method === "PUT"
        ) {
          const body = JSON.parse(init?.body as string);
          return jsonResponse({ id: 100, annotated_dialog_id: 10, dialog_message_id: 50, ...body });
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

    const { result } = renderHook(
      () => useTtsVoices("elevenlabs", "eleven_multilingual_v2"),
      {
        wrapper,
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(voices);
    expect(fetch).toHaveBeenCalledWith(
      "/api/tts/elevenlabs/voices?model=eleven_multilingual_v2",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches TTS models for a provider", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsModels("elevenlabs"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(ttsModels);
    expect(fetch).toHaveBeenCalledWith(
      "/api/tts/elevenlabs/models",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("disables voices query when providerId is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsVoices(null, "model"), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("disables voices query when model is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsVoices("elevenlabs", null), {
      wrapper,
    });

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

  it("fetches LLM providers", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useLlmProviders(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(llmProviders);
    expect(fetch).toHaveBeenCalledWith(
      "/api/providers?type=llm",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches models for an LLM provider", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useLlmModels("openai"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(llmModels);
    expect(fetch).toHaveBeenCalledWith(
      "/api/llm/openai/models",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("disables models query when providerId is null", () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useLlmModels(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches annotation prompts", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useAnnotationPrompts(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(annotationPrompts);
    expect(fetch).toHaveBeenCalledWith(
      "/api/annotation-prompts",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("provides structured query keys via ttsKeys", () => {
    expect(ttsKeys.providers()).toEqual(["tts", "providers"]);
    expect(ttsKeys.models("elevenlabs")).toEqual([
      "tts",
      "models",
      "elevenlabs",
    ]);
    expect(ttsKeys.voices("elevenlabs", "eleven_multilingual_v2")).toEqual([
      "tts",
      "voices",
      "elevenlabs",
      "eleven_multilingual_v2",
    ]);
    expect(ttsKeys.dialogs()).toEqual(["tts", "dialogs"]);
    expect(ttsKeys.annotations(1)).toEqual(["tts", "annotations", 1]);
    expect(ttsKeys.annotation(10)).toEqual(["tts", "annotation", 10]);
    expect(ttsKeys.dialogDetail(1)).toEqual(["tts", "dialog-detail", 1]);
    expect(ttsKeys.llmProviders()).toEqual(["tts", "llmProviders"]);
    expect(ttsKeys.llmModels("openai")).toEqual([
      "tts",
      "llmModels",
      "openai",
    ]);
    expect(ttsKeys.annotationPrompts()).toEqual(["tts", "annotationPrompts"]);
  });

  it("auto-annotates and invalidates annotation queries", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    // Seed the annotations cache to verify invalidation
    queryClient.setQueryData(ttsKeys.annotations(1), annotations);

    const { result } = renderHook(() => useAutoAnnotate(), { wrapper });

    await result.current.mutateAsync({
      dialogId: 1,
      providerId: "openai",
      model: "gpt-4o",
      annotationPromptId: 1,
      ttsProviderId: "elevenlabs",
      title: "Auto-annotated",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/services/annotate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dialogId: 1,
          providerId: "openai",
          model: "gpt-4o",
          annotationPromptId: 1,
          ttsProviderId: "elevenlabs",
          title: "Auto-annotated",
        }),
      }),
    );
  });

  it("creates an annotation shell and invalidates annotations list", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    queryClient.setQueryData(ttsKeys.annotations(1), annotations);

    const { result } = renderHook(() => useCreateAnnotation(), { wrapper });

    await result.current.mutateAsync({
      dialogId: 1,
      data: { provider_id: "elevenlabs", title: "New variant" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/dialogs/1/annotations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          provider_id: "elevenlabs",
          title: "New variant",
        }),
      }),
    );
  });

  it("creates an annotated message", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useCreateAnnotationMessage(), {
      wrapper,
    });

    await result.current.mutateAsync({
      annotationId: 10,
      data: { dialog_message_id: 1, text: "Annotated text" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/annotations/10/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dialog_message_id: 1,
          text: "Annotated text",
        }),
      }),
    );
  });

  it("updates an annotated message", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useUpdateAnnotatedMessage(), {
      wrapper,
    });

    await result.current.mutateAsync({
      annotationId: 10,
      messageId: 100,
      data: { text: "Updated text" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/annotations/10/messages/100",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ text: "Updated text" }),
      }),
    );
  });
});
