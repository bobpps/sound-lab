import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestQueryClient,
  createTestWrapper,
} from "../../../test-utils.tsx";
import {
  annotationPromptKeys,
  dialogKeys,
  ttsProviderKeys,
  useAnnotationPrompt,
  useAnnotationPrompts,
  useCreateAnnotationPrompt,
  useCreateDialog,
  useDialogs,
  useTtsProviders,
} from "./queries.ts";

const createdDialog = {
  id: 5,
  title: "Untitled dialog",
  description: null,
  language: "en-US",
  created_by: null,
  created_at: "2026-04-03T10:00:00.000Z",
};

const createdPrompt = {
  id: 7,
  title: "Narration prompt",
  provider_id: "google",
  language: "en-US",
  prompt: "Annotate this dialog for narration.",
  created_by: null,
  created_at: "2026-04-03T11:00:00.000Z",
};

const ttsProviders = [
  {
    id: "google",
    name: "Google",
    type: "tts" as const,
    enabled: true,
    created_at: "2026-04-03T09:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.pathname + input.search;
  }

  return input.url;
}

describe("datasets queries", () => {
  let dialogs = [createdDialog];
  let prompts = [createdPrompt];

  beforeEach(() => {
    dialogs = [createdDialog];
    prompts = [createdPrompt];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/dialogs") && (!init?.method || init.method === "GET")) {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs") && init?.method === "POST") {
          const payload = JSON.parse(String(init.body)) as {
            title: string;
            language: string;
          };

          const nextDialog = {
            ...createdDialog,
            id: 6,
            title: payload.title,
            language: payload.language,
          };
          dialogs = [...dialogs, nextDialog];
          return jsonResponse(nextDialog, 201);
        }

        if (
          url.endsWith("/api/annotation-prompts") &&
          (!init?.method || init.method === "GET")
        ) {
          return jsonResponse(prompts);
        }

        if (
          url.endsWith("/api/annotation-prompts/7") &&
          (!init?.method || init.method === "GET")
        ) {
          return jsonResponse(createdPrompt);
        }

        if (url.endsWith("/api/annotation-prompts") && init?.method === "POST") {
          const payload = JSON.parse(String(init.body)) as {
            title: string;
            provider_id: string;
            language: string;
            prompt: string;
          };

          const nextPrompt = {
            ...createdPrompt,
            id: 8,
            title: payload.title,
            provider_id: payload.provider_id,
            language: payload.language,
            prompt: payload.prompt,
          };
          prompts = [...prompts, nextPrompt];
          return jsonResponse(nextPrompt, 201);
        }

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(ttsProviders);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches dialogs with the expected API route", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useDialogs(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(dialogs);
    expect(fetch).toHaveBeenCalledWith(
      "/api/dialogs",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("invalidates the dialogs list after creating a dialog", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result: dialogsResult } = renderHook(() => useDialogs(), { wrapper });
    const { result: mutationResult } = renderHook(() => useCreateDialog(), {
      wrapper,
    });

    await waitFor(() => {
      expect(dialogsResult.current.isSuccess).toBe(true);
    });

    await act(async () => {
      await mutationResult.current.mutateAsync({
        title: "Fresh dialog",
        language: "en-US",
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(dialogKeys.list())).toHaveLength(2);
    });

    expect(queryClient.getQueryData(dialogKeys.list())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Fresh dialog" }),
      ]),
    );
  });

  it("fetches annotation prompts and prompt detail", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result: listResult } = renderHook(() => useAnnotationPrompts(), {
      wrapper,
    });
    const { result: detailResult } = renderHook(() => useAnnotationPrompt(7), {
      wrapper,
    });

    await waitFor(() => {
      expect(listResult.current.isSuccess).toBe(true);
      expect(detailResult.current.isSuccess).toBe(true);
    });

    expect(listResult.current.data).toEqual(prompts);
    expect(detailResult.current.data).toEqual(createdPrompt);
    expect(fetch).toHaveBeenCalledWith(
      "/api/annotation-prompts",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/annotation-prompts/7",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("fetches TTS providers for prompt forms", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result } = renderHook(() => useTtsProviders(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(ttsProviders);
    expect(queryClient.getQueryData(ttsProviderKeys.list())).toEqual(ttsProviders);
    expect(fetch).toHaveBeenCalledWith(
      "/api/providers?type=tts",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("invalidates the annotation prompt list after creating a prompt", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    const { result: promptsResult } = renderHook(() => useAnnotationPrompts(), {
      wrapper,
    });
    const { result: mutationResult } = renderHook(
      () => useCreateAnnotationPrompt(),
      {
        wrapper,
      },
    );

    await waitFor(() => {
      expect(promptsResult.current.isSuccess).toBe(true);
    });

    await act(async () => {
      await mutationResult.current.mutateAsync({
        title: "Fresh prompt",
        provider_id: "google",
        language: "en-US",
        prompt: "Write pacing hints for each line.",
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(annotationPromptKeys.list())).toHaveLength(2);
    });

    expect(queryClient.getQueryData(annotationPromptKeys.list())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Fresh prompt" }),
      ]),
    );
  });
});
