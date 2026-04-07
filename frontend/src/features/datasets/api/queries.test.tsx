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
  useEditDialog,
  useGenerateDialog,
  useLlmModels,
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

const existingDialogDetail = {
  ...createdDialog,
  messages: [
    {
      id: 11,
      dialog_id: 5,
      order: 1,
      character: 1,
      text: "Hello there",
    },
  ],
};

const generatedDialog = {
  id: 6,
  title: "Fresh generated dialog",
  description: null,
  language: "en-GB",
  created_by: null,
  created_at: "2026-04-04T10:00:00.000Z",
  messages: [
    {
      id: 21,
      dialog_id: 6,
      order: 1,
      character: 1,
      text: "Good morning",
    },
    {
      id: 22,
      dialog_id: 6,
      order: 2,
      character: 2,
      text: "Morning, how can I help?",
    },
  ],
};

const editedDialog = {
  ...createdDialog,
  messages: [
    {
      id: 11,
      dialog_id: 5,
      order: 1,
      character: 1,
      text: "A more polished greeting",
    },
  ],
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

const llmModels = ["gpt-4o", "gpt-4.1-mini"];

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

function toDialogSummary(dialog: typeof generatedDialog) {
  return {
    id: dialog.id,
    title: dialog.title,
    description: dialog.description,
    language: dialog.language,
    created_by: dialog.created_by,
    created_at: dialog.created_at,
  };
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
        const method = init?.method ?? "GET";

        if (url.endsWith("/api/dialogs") && method === "GET") {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs") && method === "POST") {
          const payload = JSON.parse(String(init?.body)) as {
            title: string;
            language: string;
          };

          const nextDialog = {
            ...createdDialog,
            id: 7,
            title: payload.title,
            language: payload.language,
          };
          dialogs = [...dialogs, nextDialog];
          return jsonResponse(nextDialog, 201);
        }

        if (url.endsWith("/api/annotation-prompts") && method === "GET") {
          return jsonResponse(prompts);
        }

        if (url.endsWith("/api/annotation-prompts/7") && method === "GET") {
          return jsonResponse(createdPrompt);
        }

        if (url.endsWith("/api/annotation-prompts") && method === "POST") {
          const payload = JSON.parse(String(init?.body)) as {
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

        if (url.endsWith("/api/providers?type=tts") && method === "GET") {
          return jsonResponse(ttsProviders);
        }

        if (url.endsWith("/api/llm/openai/models") && method === "GET") {
          return jsonResponse(llmModels);
        }

        if (url.endsWith("/api/services/generate-dialog") && method === "POST") {
          dialogs = [...dialogs, toDialogSummary(generatedDialog)];
          return jsonResponse(generatedDialog, 201);
        }

        if (url.endsWith("/api/services/edit-dialog") && method === "POST") {
          return jsonResponse(editedDialog);
        }

        return jsonResponse(
          {
            statusCode: 404,
            error: "Not Found",
            message: "Not Found",
          },
          404,
        );
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

  it("loads models for the selected LLM provider", async () => {
    const wrapper = createTestWrapper();

    const { result } = renderHook(() => useLlmModels("openai"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(llmModels);
    expect(fetch).toHaveBeenCalledWith(
      "/api/llm/openai/models",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("stores the generated dialog in cache and refreshes the list", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createTestWrapper({ queryClient });

    renderHook(() => useDialogs(), { wrapper });
    const { result } = renderHook(() => useGenerateDialog(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        providerId: "openai",
        model: "gpt-4o",
        language: "en-GB",
        prompt: "Write a polite support conversation",
        messageCount: 2,
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(dialogKeys.detail(6))).toEqual(generatedDialog);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(dialogKeys.list())).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 6, title: "Fresh generated dialog" }),
        ]),
      );
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/services/generate-dialog",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          providerId: "openai",
          model: "gpt-4o",
          language: "en-GB",
          prompt: "Write a polite support conversation",
          messageCount: 2,
        }),
      }),
    );
  });

  it("updates the detail cache after an LLM edit", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(dialogKeys.detail(5), existingDialogDetail);

    const wrapper = createTestWrapper({ queryClient });
    const { result } = renderHook(() => useEditDialog(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        dialogId: 5,
        providerId: "openai",
        model: "gpt-4o",
        instructions: "Make the opening line more polished",
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(dialogKeys.detail(5))).toEqual(editedDialog);
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/services/edit-dialog",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dialogId: 5,
          providerId: "openai",
          model: "gpt-4o",
          instructions: "Make the opening line more polished",
        }),
      }),
    );
  });
});
