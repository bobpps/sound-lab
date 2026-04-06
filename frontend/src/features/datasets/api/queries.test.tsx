import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestQueryClient,
  createTestWrapper,
} from "../../../test-utils.tsx";
import { dialogKeys, useCreateDialog, useDialogs } from "./queries.ts";

const createdDialog = {
  id: 5,
  title: "Untitled dialog",
  description: null,
  language: "en-US",
  created_by: null,
  created_at: "2026-04-03T10:00:00.000Z",
};

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
  let dialogs = [createdDialog];

  beforeEach(() => {
    dialogs = [createdDialog];

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
});
