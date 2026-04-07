import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { DialogList } from "./DialogList.tsx";

const dialogs = [
  {
    id: 1,
    title: "Greeting practice",
    description: null,
    language: "en-US",
    created_by: null,
    created_at: "2026-04-01T10:00:00.000Z",
  },
  {
    id: 2,
    title: "Support escalation",
    description: null,
    language: "en-GB",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

const generatedDialog = {
  id: 99,
  title: "Generated support flow",
  description: null,
  language: "en-US",
  created_by: null,
  created_at: "2026-04-03T10:00:00.000Z",
  messages: [
    {
      id: 300,
      dialog_id: 99,
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

function renderDialogList() {
  return renderWithProviders(
    <Routes>
      <Route path="/datasets" element={<DialogList />} />
      <Route path="/datasets/dialogs/:dialogId" element={<h1>Editor Stub</h1>} />
    </Routes>,
    { route: "/datasets" },
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = extractUrl(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/dialogs") && method === "GET") {
        return jsonResponse(dialogs);
      }

      if (url.endsWith("/api/dialogs") && method === "POST") {
        return jsonResponse({
          id: 100,
          title: "Untitled dialog",
          description: null,
          language: "en-US",
          created_by: null,
          created_at: "2026-04-03T10:00:00.000Z",
        }, 201);
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

describe("DialogList", () => {
  it("renders dialogs from the API", async () => {
    renderDialogList();

    expect(
      await screen.findByRole("link", { name: "Support escalation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Greeting practice" })).toBeInTheDocument();
    expect(screen.getByText("en-GB")).toBeInTheDocument();
  });

  it("creates a dialog and navigates to the editor", async () => {
    const user = userEvent.setup();

    renderDialogList();

    await screen.findByRole("button", { name: "New Dialog" });
    await user.click(screen.getByRole("button", { name: "New Dialog" }));

    expect(
      await screen.findByRole("heading", { name: "Editor Stub" }),
    ).toBeInTheDocument();
  });

  it("generates a new dialog through the LLM modal and navigates to the editor", async () => {
    const user = userEvent.setup();

    renderDialogList();

    await screen.findByRole("button", { name: "Generate New" });
    await user.click(screen.getByRole("button", { name: "Generate New" }));

    await screen.findByRole("dialog", { name: "Generate Dialog" });
    await screen.findByRole("option", { name: "gpt-4o" });

    await user.type(
      screen.getByLabelText("Prompt"),
      "Generate a short retail support exchange",
    );
    await user.click(screen.getByRole("button", { name: "Generate Dialog" }));

    expect(
      await screen.findByRole("heading", { name: "Editor Stub" }),
    ).toBeInTheDocument();
  });
});
