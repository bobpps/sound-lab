import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { annotationPromptKeys } from "../api/queries.ts";
import { createTestQueryClient, renderWithProviders } from "../../../test-utils.tsx";
import { PromptEditor } from "./PromptEditor.tsx";

const providers = [
  {
    id: "google",
    name: "Google",
    type: "tts" as const,
    enabled: true,
    created_at: "2026-04-01T09:00:00.000Z",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    type: "tts" as const,
    enabled: true,
    created_at: "2026-04-01T09:30:00.000Z",
  },
];

const initialPrompt = {
  id: 1,
  title: "Narration prompt",
  provider_id: "google",
  language: "en-US",
  prompt: "Annotate each line for narration pacing.",
  created_by: null,
  created_at: "2026-04-01T10:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function noContentResponse() {
  return new Response(null, { status: 204 });
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

function renderPromptEditor(queryClient = createTestQueryClient()) {
  return renderWithProviders(
    <Routes>
      <Route path="/datasets" element={<h1>Datasets Stub</h1>} />
      <Route path="/datasets/prompts/:promptId" element={<PromptEditor />} />
    </Routes>,
    {
      queryClient,
      route: "/datasets/prompts/1",
    },
  );
}

describe("PromptEditor", () => {
  let currentPrompt = initialPrompt;

  beforeEach(() => {
    currentPrompt = structuredClone(initialPrompt);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = extractUrl(input);

        if (
          url.endsWith("/api/annotation-prompts/1") &&
          (!init?.method || init.method === "GET")
        ) {
          return jsonResponse(currentPrompt);
        }

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(providers);
        }

        if (url.endsWith("/api/annotation-prompts/1") && init?.method === "PUT") {
          const payload = JSON.parse(String(init.body)) as {
            title?: string;
            provider_id?: string;
            language?: string;
            prompt?: string;
          };

          currentPrompt = {
            ...currentPrompt,
            title: payload.title ?? currentPrompt.title,
            provider_id: payload.provider_id ?? currentPrompt.provider_id,
            language: payload.language ?? currentPrompt.language,
            prompt: payload.prompt ?? currentPrompt.prompt,
          };

          return jsonResponse(currentPrompt);
        }

        if (
          url.endsWith("/api/annotation-prompts/1") &&
          init?.method === "DELETE"
        ) {
          return noContentResponse();
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves unsaved edits when the detail query refetches", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();

    renderPromptEditor(queryClient);

    const titleInput = await screen.findByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Unsaved local prompt title");

    currentPrompt = {
      ...currentPrompt,
      title: "Server title after refetch",
    };

    await queryClient.refetchQueries({
      queryKey: annotationPromptKeys.detail(1),
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Title")).toHaveValue(
        "Unsaved local prompt title",
      );
    });
  });

  it("saves metadata and prompt body changes", async () => {
    const user = userEvent.setup();

    renderPromptEditor();

    const titleInput = await screen.findByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Saved prompt title");
    await user.selectOptions(screen.getByLabelText("Language"), "en-GB");
    await user.selectOptions(screen.getByLabelText("TTS Provider"), "elevenlabs");
    await user.clear(screen.getByLabelText("Prompt body"));
    await user.type(
      screen.getByLabelText("Prompt body"),
      "Write clearer pacing hints for each line.",
    );

    await user.click(screen.getByRole("button", { name: "Save Prompt" }));

    expect(
      await screen.findByText("Prompt saved."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/annotation-prompts/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            title: "Saved prompt title",
            language: "en-GB",
            provider_id: "elevenlabs",
            prompt: "Write clearer pacing hints for each line.",
          }),
        }),
      );
    });
  });

  it("deletes the prompt and navigates back to datasets", async () => {
    const user = userEvent.setup();
    const confirmMock = vi.fn(() => true);
    Object.defineProperty(window, "confirm", {
      value: confirmMock,
      writable: true,
    });

    renderPromptEditor();

    await screen.findByRole("heading", { name: "Prompt Editor" });
    await user.click(screen.getByRole("button", { name: "Delete Prompt" }));

    expect(
      await screen.findByRole("heading", { name: "Datasets Stub" }),
    ).toBeInTheDocument();
    expect(confirmMock).toHaveBeenCalledWith("Delete this prompt?");
  });
});
