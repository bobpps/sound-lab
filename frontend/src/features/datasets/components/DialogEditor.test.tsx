import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dialogKeys } from "../api/queries.ts";
import { createTestQueryClient, renderWithProviders } from "../../../test-utils.tsx";
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

        if (url.endsWith("/api/dialogs/1") && (!init?.method || init.method === "GET")) {
          return jsonResponse(currentDialog);
        }

        if (url.endsWith("/api/dialogs/1") && init?.method === "PUT") {
          const payload = JSON.parse(String(init.body)) as {
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

    expect(
      await screen.findByText("Dialog saved."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Saved title");
  });
});
