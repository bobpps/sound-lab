import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimePage } from "./RealtimePage.tsx";

const promptsByProvider: Record<string, Array<{
  created_at: string;
  created_by: null;
  id: number;
  language: string;
  prompt: string;
  provider_id: string;
  title: string;
}>> = {
  "openai-realtime": [
    {
      id: 1,
      title: "OpenAI support agent",
      provider_id: "openai-realtime",
      language: "en-US",
      prompt: "Act as a concise technical support agent.",
      created_by: null,
      created_at: "2026-04-07T09:00:00.000Z",
    },
  ],
  "gemini-realtime": [
    {
      id: 2,
      title: "Gemini coach",
      provider_id: "gemini-realtime",
      language: "en-US",
      prompt: "Act as a calm pronunciation coach.",
      created_by: null,
      created_at: "2026-04-07T09:10:00.000Z",
    },
  ],
  "elevenlabs-realtime": [],
  "inworld-realtime": [],
};

const modelsByProvider: Record<string, string[]> = {
  "openai-realtime": ["gpt-realtime-mini"],
  "gemini-realtime": ["gemini-2.5-flash-preview-native-audio-dialog"],
  "elevenlabs-realtime": ["elevenlabs-conversational-v1"],
  "inworld-realtime": ["inworld-voice-runtime"],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RealtimePage />
    </QueryClientProvider>,
  );
}

describe("RealtimePage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.endsWith("/agent-prompts")) {
        return jsonResponse(Object.values(promptsByProvider).flat());
      }

      for (const [providerId, models] of Object.entries(modelsByProvider)) {
        if (method === "GET" && url.endsWith(`/realtime/${providerId}/models`)) {
          return jsonResponse(models);
        }
      }

      if (method === "POST" && url.endsWith("/agent-prompts")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          language: string;
          prompt: string;
          provider_id: string;
          title: string;
        };
        const nextPrompt = {
          id: 99,
          title: body.title,
          provider_id: body.provider_id,
          language: body.language,
          prompt: body.prompt,
          created_by: null,
          created_at: "2026-04-07T09:30:00.000Z",
        };
        promptsByProvider[body.provider_id] = [
          nextPrompt,
          ...promptsByProvider[body.provider_id],
        ];
        return jsonResponse(nextPrompt, 201);
      }

      return jsonResponse(
        {
          statusCode: 404,
          error: "Not Found",
          message: `Unhandled request: ${method} ${url}`,
        },
        404,
      );
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();

    promptsByProvider["openai-realtime"] = [
      {
        id: 1,
        title: "OpenAI support agent",
        provider_id: "openai-realtime",
        language: "en-US",
        prompt: "Act as a concise technical support agent.",
        created_by: null,
        created_at: "2026-04-07T09:00:00.000Z",
      },
    ];
    promptsByProvider["gemini-realtime"] = [
      {
        id: 2,
        title: "Gemini coach",
        provider_id: "gemini-realtime",
        language: "en-US",
        prompt: "Act as a calm pronunciation coach.",
        created_by: null,
        created_at: "2026-04-07T09:10:00.000Z",
      },
    ];
    promptsByProvider["elevenlabs-realtime"] = [];
    promptsByProvider["inworld-realtime"] = [];
  });

  it("renders OpenAI controls by default and switches to Gemini", async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Realtime" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("OpenAI Session")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("gpt-realtime-mini"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Gemini" }));

    expect(await screen.findByText("Gemini Session")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("gemini-2.5-flash-preview-native-audio-dialog"),
    ).toBeInTheDocument();
  });

  it("creates a new agent prompt inline for the active provider", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole("tab", { name: "ElevenLabs" }));
    await screen.findByText("ElevenLabs Session");
    await user.click(screen.getByRole("button", { name: "Create Prompt" }));
    await user.type(screen.getByLabelText("Prompt title"), "Sales rep");
    await user.clear(screen.getByLabelText("Language"));
    await user.type(screen.getByLabelText("Language"), "en-US");
    await user.type(
      screen.getByLabelText("Prompt body"),
      "Act as a polite sales representative.",
    );
    await user.click(screen.getByRole("button", { name: "Save Prompt" }));

    expect((await screen.findAllByText("Sales rep")).length).toBeGreaterThan(0);
  });
});
