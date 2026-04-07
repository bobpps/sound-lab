import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestQueryClient,
  createTestWrapper,
} from "../../../test-utils.tsx";
import {
  dialogKeys,
  useCreateDialog,
  useDialogs,
  useEditDialog,
  useGenerateDialog,
  useLlmModels,
} from "./queries.ts";

const existingDialog = {
  id: 5,
  title: "Untitled dialog",
  description: null,
  language: "en-US",
  created_by: null,
  created_at: "2026-04-03T10:00:00.000Z",
};

const existingDialogDetail = {
  ...existingDialog,
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
  ...existingDialog,
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
    return input.pathname;
  }

  return input.url;
}

describe("datasets queries", () => {
  let dialogs = [existingDialog];

  beforeEach(() => {
    dialogs = [existingDialog];

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
            ...existingDialog,
            id: 7,
            title: payload.title,
            language: payload.language,
          };
          dialogs = [...dialogs, nextDialog];
          return jsonResponse(nextDialog, 201);
        }

        if (url.endsWith("/api/llm/openai/models") && method === "GET") {
          return jsonResponse(llmModels);
        }

        if (url.endsWith("/api/services/generate-dialog") && method === "POST") {
          dialogs = [
            ...dialogs,
            {
              ...generatedDialog,
              messages: undefined,
            },
          ].map((dialog) => ({
            id: dialog.id,
            title: dialog.title,
            description: dialog.description,
            language: dialog.language,
            created_by: dialog.created_by,
            created_at: dialog.created_at,
          }));

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
