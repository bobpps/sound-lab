import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dialogKeys } from "../api/queries.ts";
import {
  createTestQueryClient,
  renderWithProviders,
} from "../../../test-utils.tsx";
import { DialogEditor } from "./DialogEditor.tsx";

const initialDialog = {
  id: 1,
  title: "Greeting practice",
  description: "Warm intro",
  language: "en-US",
  created_by: null,
  created_at: "2026-04-01T10:00:00.000Z",
  messages: [
    {
      id: 10,
      dialog_id: 1,
      order: 1,
      character: 1,
      text: "Hello there",
    },
  ],
};

const generatedDialog = {
  id: 99,
  title: "Generated support flow",
  description: null,
  language: "en-US",
  created_by: null,
  created_at: "2026-04-03T10:00:00.000Z",
  messages: [
    {
      id: 30,
      dialog_id: 99,
      order: 1,
      character: 1,
      text: "Welcome to support",
    },
  ],
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

function renderDialogEditor(queryClient = createTestQueryClient()) {
  return renderWithProviders(
    <Routes>
      <Route path="/datasets/dialogs/99" element={<h1>Generated Dialog Stub</h1>} />
      <Route path="/datasets/dialogs/:dialogId" element={<DialogEditor />} />
    </Routes>,
    {
      queryClient,
      route: "/datasets/dialogs/1",
    },
  );
}

describe("DialogEditor", () => {
  let currentDialog = initialDialog;

  beforeEach(() => {
    currentDialog = structuredClone(initialDialog);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = extractUrl(input);
        const method = init?.method ?? "GET";

        if (url.endsWith("/api/dialogs/1") && method === "GET") {
          return jsonResponse(currentDialog);
        }

        if (url.endsWith("/api/dialogs/1") && method === "PUT") {
          const payload = JSON.parse(String(init?.body)) as {
            title?: string;
            description?: string;
            language?: string;
          };

          currentDialog = {
            ...currentDialog,
            title: payload.title ?? currentDialog.title,
            description: payload.description ?? currentDialog.description,
            language: payload.language ?? currentDialog.language,
          };

          return jsonResponse(currentDialog);
        }

        if (url.endsWith("/api/providers?type=llm") && method === "GET") {
          return jsonResponse([
            {
              id: "openai",
              name: "OpenAI",
              type: "llm",
              enabled: true,
              created_at: "2026-04-03T10:00:00.000Z",
            },
          ]);
        }

        if (url.endsWith("/api/llm/openai/models") && method === "GET") {
          return jsonResponse(["gpt-4o"]);
        }

        if (url.endsWith("/api/services/generate-dialog") && method === "POST") {
          return jsonResponse(generatedDialog, 201);
        }

        if (url.endsWith("/api/services/edit-dialog") && method === "POST") {
          currentDialog = {
            ...currentDialog,
            messages: [
              {
                ...currentDialog.messages[0],
                text: "A refined and more polished greeting",
              },
            ],
          };

          return jsonResponse(currentDialog);
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

  it("preserves unsaved edits when the detail query refetches", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();

    renderDialogEditor(queryClient);

    const titleInput = await screen.findByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Unsaved local draft");

    currentDialog = {
      ...currentDialog,
      title: "Server title after refetch",
    };

    await queryClient.refetchQueries({
      queryKey: dialogKeys.detail(1),
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Title")).toHaveValue("Unsaved local draft");
    });
  });

  it("saves metadata changes and shows a success notice", async () => {
    const user = userEvent.setup();

    renderDialogEditor();

    const titleInput = await screen.findByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Saved title");

    await user.click(screen.getByRole("button", { name: "Save Dialog" }));

    expect(await screen.findByText("Dialog saved.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Saved title");
  });

  it("generates a new dialog from the editor and navigates to it", async () => {
    const user = userEvent.setup();

    renderDialogEditor();

    await screen.findByRole("button", { name: "Generate" });
    await user.click(screen.getByRole("button", { name: "Generate" }));

    await screen.findByRole("dialog", { name: "Generate Dialog" });
    await screen.findByRole("option", { name: "gpt-4o" });

    await user.type(
      screen.getByLabelText("Prompt"),
      "Generate an escalation flow for a billing issue",
    );
    await user.click(screen.getByRole("button", { name: "Generate Dialog" }));

    expect(
      await screen.findByRole("heading", { name: "Generated Dialog Stub" }),
    ).toBeInTheDocument();
  });

  it("applies LLM edits and refreshes the visible dialog content", async () => {
    const user = userEvent.setup();

    renderDialogEditor();

    expect(await screen.findByDisplayValue("Hello there")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit with LLM" }));

    await screen.findByRole("dialog", { name: "Edit Dialog with LLM" });
    await screen.findByRole("option", { name: "gpt-4o" });

    await user.type(
      screen.getByLabelText("Instructions"),
      "Make the first line warmer and more polished",
    );
    await user.click(screen.getByRole("button", { name: "Apply Edit" }));

    expect(await screen.findByText("Dialog updated with LLM.")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("A refined and more polished greeting"),
    ).toBeInTheDocument();
  });
});
