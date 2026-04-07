import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { PromptList } from "./PromptList.tsx";

const prompts = [
  {
    id: 1,
    title: "Narration prompt",
    provider_id: "google",
    language: "en-US",
    prompt: "Annotate this dialog for narration.",
    created_by: null,
    created_at: "2026-04-01T10:00:00.000Z",
  },
  {
    id: 2,
    title: "Support prompt",
    provider_id: "elevenlabs",
    language: "en-GB",
    prompt: "Add pacing notes to each line.",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

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

function renderPromptList() {
  return renderWithProviders(
    <Routes>
      <Route path="/datasets" element={<PromptList />} />
      <Route path="/datasets/prompts/:promptId" element={<h1>Prompt Editor Stub</h1>} />
    </Routes>,
    { route: "/datasets" },
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = extractUrl(input);

      if (
        url.endsWith("/api/annotation-prompts") &&
        (!init?.method || init.method === "GET")
      ) {
        return jsonResponse(prompts);
      }

      if (url.endsWith("/api/providers?type=tts")) {
        return jsonResponse(providers);
      }

      if (url.endsWith("/api/annotation-prompts") && init?.method === "POST") {
        return jsonResponse(
          {
            id: 99,
            title: "Untitled prompt",
            provider_id: "google",
            language: "en-US",
            prompt: "",
            created_by: null,
            created_at: "2026-04-03T10:00:00.000Z",
          },
          201,
        );
      }

      return jsonResponse({ message: "Not Found" }, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PromptList", () => {
  it("renders prompts from the API with provider names", async () => {
    renderPromptList();

    expect(
      await screen.findByRole("link", { name: "Support prompt" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Narration prompt" })).toBeInTheDocument();
    expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
  });

  it("creates a prompt and navigates to the editor", async () => {
    const user = userEvent.setup();

    renderPromptList();

    await screen.findByRole("button", { name: "New Prompt" });
    await user.click(screen.getByRole("button", { name: "New Prompt" }));

    expect(
      await screen.findByRole("heading", { name: "Prompt Editor Stub" }),
    ).toBeInTheDocument();
  });
});
