import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouteTree } from "./router.tsx";

const dialogsResponse = [
  {
    id: 1,
    title: "Greeting practice",
    description: "Simple hello-world exchange",
    language: "en-US",
    created_by: null,
    created_at: "2026-04-06T18:00:00.000Z",
  },
];

const dialogDetailResponse = {
  ...dialogsResponse[0],
  messages: [
    {
      id: 10,
      dialog_id: 1,
      order: 1,
      character: 1,
      text: "Hello there",
    },
    {
      id: 11,
      dialog_id: 1,
      order: 2,
      character: 2,
      text: "Hi, nice to meet you",
    },
  ],
};

const promptsResponse = [
  {
    id: 1,
    title: "Narration prompt",
    provider_id: "google",
    language: "en-US",
    prompt: "Annotate this dialog for narration pacing.",
    created_by: null,
    created_at: "2026-04-06T18:30:00.000Z",
  },
];

const realtimePromptsResponse = [
  {
    id: 11,
    title: "Realtime assistant",
    provider_id: "openai-realtime",
    language: "en-US",
    prompt: "Act as a concise assistant during live calls.",
    created_by: null,
    created_at: "2026-04-06T19:00:00.000Z",
  },
  {
    id: 12,
    title: "Gemini assistant",
    provider_id: "gemini-realtime",
    language: "",
    prompt: "Act as a concise Gemini assistant during live calls.",
    created_by: null,
    created_at: "2026-04-06T19:05:00.000Z",
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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithRouter(initialEntries: string[] = ["/"]) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRouteTree />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = extractUrl(input);

      if (url.endsWith("/api/dialogs")) {
        return jsonResponse(dialogsResponse);
      }

      if (url.endsWith("/api/dialogs/1")) {
        return jsonResponse(dialogDetailResponse);
      }

      if (url.endsWith("/api/annotation-prompts")) {
        return jsonResponse(promptsResponse);
      }

      if (url.endsWith("/api/annotation-prompts/1")) {
        return jsonResponse(promptsResponse[0]);
      }

      if (url.includes("/api/providers?type=")) {
        return jsonResponse([
          {
            id: "google",
            name: "Google",
            type: "tts",
            enabled: true,
            created_at: "2026-04-06T17:00:00.000Z",
          },
        ]);
      }

      if (url.endsWith("/api/agent-prompts")) {
        return jsonResponse(realtimePromptsResponse);
      }

      if (url.endsWith("/api/realtime/openai-realtime/models")) {
        return jsonResponse(["gpt-realtime-mini"]);
      }

      if (url.endsWith("/api/realtime/gemini-realtime/models")) {
        return jsonResponse([
          "gemini-2.5-flash-native-audio-latest",
          "gemini-3.1-flash-live-preview",
        ]);
      }

      if (url.endsWith("/api/realtime/gemini-realtime-sdk/models")) {
        return jsonResponse([
          "gemini-2.5-flash-native-audio-latest",
          "gemini-3.1-flash-live-preview",
        ]);
      }

      if (url.includes("/api/realtime/gemini-realtime/voices")) {
        return jsonResponse([
          {
            id: "Zephyr",
            name: "Zephyr",
            language: "multi",
            providerMeta: {
              supportedModels: ["gemini-2.5-flash-native-audio-latest"],
            },
          },
        ]);
      }

      if (url.includes("/api/realtime/gemini-realtime-sdk/voices")) {
        return jsonResponse([
          {
            id: "Zephyr",
            name: "Zephyr",
            language: "multi",
            providerMeta: {
              supportedModels: ["gemini-2.5-flash-native-audio-latest"],
            },
          },
        ]);
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

describe("Router", () => {
  describe("index redirect", () => {
    it("redirects / to /datasets", async () => {
      renderWithRouter(["/"]);
      expect(
        await screen.findByRole("heading", { name: "Datasets" }),
      ).toBeInTheDocument();
    });
  });

  describe("route rendering", () => {
    it("renders Datasets page at /datasets", () => {
      renderWithRouter(["/datasets"]);
      expect(
        screen.getByRole("heading", { name: "Datasets" }),
      ).toBeInTheDocument();
    });

    it("renders Dialog Editor page at /datasets/dialogs/:dialogId", async () => {
      renderWithRouter(["/datasets/dialogs/1"]);

      expect(
        await screen.findByRole("heading", { name: "Dialog Editor" }),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Greeting practice")).toBeInTheDocument();
    });

    it("renders Prompt Editor page at /datasets/prompts/:promptId", async () => {
      renderWithRouter(["/datasets/prompts/1"]);

      expect(
        await screen.findByRole("heading", { name: "Prompt Editor" }),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Narration prompt")).toBeInTheDocument();
    });

    it("renders TTS Testing page at /tts", () => {
      renderWithRouter(["/tts"]);
      expect(
        screen.getByRole("heading", { name: "TTS Testing" }),
      ).toBeInTheDocument();
    });

    it("renders Realtime page at /realtime", () => {
      renderWithRouter(["/realtime"]);
      expect(
        screen.getByRole("heading", { name: "Realtime" }),
      ).toBeInTheDocument();
    });

    it("renders Realtime Gemini page at /realtime-gemini", async () => {
      renderWithRouter(["/realtime-gemini"]);
      expect(
        screen.getByRole("heading", { name: "Realtime Gemini" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Final phrases only" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Spoken response only" }),
      ).toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "Model Settings" }))
        .toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "thinkingConfig.thinkingBudget" }),
      ).toBeInTheDocument();
    });

    it("renders Providers page at /providers", () => {
      renderWithRouter(["/providers"]);
      expect(
        screen.getByRole("heading", { name: "Providers" }),
      ).toBeInTheDocument();
    });

    it("renders Voice Matcher page at /voice-matcher", () => {
      renderWithRouter(["/voice-matcher"]);
      expect(
        screen.getByRole("heading", { name: "Voice Matcher" }),
      ).toBeInTheDocument();
    });
  });

  describe("Sidebar", () => {
    it("renders all 6 navigation links", () => {
      renderWithRouter(["/datasets"]);
      const nav = screen.getByRole("navigation");
      const links = within(nav).getAllByRole("link");

      expect(links).toHaveLength(6);
      expect(nav).toContainElement(links[0]);
    });

    it("renders links with correct labels", () => {
      renderWithRouter(["/datasets"]);
      expect(screen.getByRole("link", { name: "Datasets" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "TTS Testing" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Realtime" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Realtime Gemini" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Providers" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Voice Matcher" })).toBeInTheDocument();
    });

    it("highlights the active nav link", () => {
      renderWithRouter(["/tts"]);
      const ttsLink = screen.getByRole("link", { name: "TTS Testing" });
      const datasetsLink = screen.getByRole("link", { name: "Datasets" });

      expect(ttsLink).toHaveClass("bg-gray-800", "text-white");
      expect(datasetsLink).toHaveClass("text-gray-400");
      expect(datasetsLink).not.toHaveClass("bg-gray-800");
    });
  });

  describe("Header", () => {
    it('shows "Local Mode" text', () => {
      renderWithRouter(["/datasets"]);
      expect(screen.getByText("Local Mode")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("navigates between pages when clicking sidebar links", async () => {
      const user = userEvent.setup();
      renderWithRouter(["/datasets"]);

      expect(
        await screen.findByRole("heading", { name: "Datasets" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "TTS Testing" }));

      expect(
        screen.getByRole("heading", { name: "TTS Testing" }),
      ).toBeInTheDocument();
    });
  });
});
