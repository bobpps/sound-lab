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

const voicesByProviderAndModel: Record<string, Record<string, Array<{
  id: string;
  name: string;
  language: string;
  gender?: string;
}>>> = {
  "openai-realtime": {
    "gpt-realtime-mini": [
      { id: "marin", name: "Marin", language: "multi", gender: "female" },
      { id: "cedar", name: "Cedar", language: "multi", gender: "male" },
    ],
  },
  "gemini-realtime": {
    "gemini-2.5-flash-preview-native-audio-dialog": [
      { id: "Kore", name: "Kore", language: "multi", gender: "female" },
    ],
  },
  "elevenlabs-realtime": {
    "elevenlabs-conversational-v1": [
      { id: "voice-1", name: "Rachel", language: "en", gender: "female" },
    ],
  },
  "inworld-realtime": {
    "inworld-voice-runtime": [
      { id: "Dennis", name: "Dennis", language: "en", gender: "male" },
    ],
  },
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

      for (const [providerId, voicesByModel] of Object.entries(voicesByProviderAndModel)) {
        if (method === "GET" && url.includes(`/realtime/${providerId}/voices`)) {
          const requestUrl = new URL(url, "http://localhost");
          return jsonResponse(voicesByModel[requestUrl.searchParams.get("model") ?? ""] ?? []);
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

      const promptMatch = url.match(/\/agent-prompts\/(\d+)$/);
      if (promptMatch && method === "PUT") {
        const promptId = Number(promptMatch[1]);
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          language?: string;
          prompt?: string;
          title?: string;
        };

        for (const [providerId, prompts] of Object.entries(promptsByProvider)) {
          const promptIndex = prompts.findIndex((prompt) => prompt.id === promptId);

          if (promptIndex >= 0) {
            const updatedPrompt = {
              ...prompts[promptIndex],
              ...body,
            };
            promptsByProvider[providerId] = prompts.map((prompt) =>
              prompt.id === promptId ? updatedPrompt : prompt,
            );
            return jsonResponse(updatedPrompt);
          }
        }
      }

      if (promptMatch && method === "DELETE") {
        const promptId = Number(promptMatch[1]);

        for (const [providerId, prompts] of Object.entries(promptsByProvider)) {
          if (prompts.some((prompt) => prompt.id === promptId)) {
            promptsByProvider[providerId] = prompts.filter(
              (prompt) => prompt.id !== promptId,
            );
            return new Response(null, { status: 204 });
          }
        }
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
    expect(await screen.findByDisplayValue("Marin · female")).toBeInTheDocument();
    expect(screen.getByText("Marin · female")).toBeInTheDocument();
    expect(screen.getByText("Language: en-US")).toBeInTheDocument();
    expect(screen.queryByLabelText("Dialog Language")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Gemini" }));

    expect(await screen.findByText("Gemini Session")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("gemini-2.5-flash-preview-native-audio-dialog"),
    ).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Kore · female")).toBeInTheDocument();
    expect(screen.queryByLabelText("Dialog Language")).not.toBeInTheDocument();
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

  it("edits the selected agent prompt inline", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText("OpenAI Session");
    await screen.findAllByText("OpenAI support agent");
    await user.click(screen.getByRole("button", { name: "Edit Prompt" }));
    await user.clear(screen.getByLabelText("Prompt title"));
    await user.type(screen.getByLabelText("Prompt title"), "OpenAI triage agent");
    await user.clear(screen.getByLabelText("Prompt body"));
    await user.type(
      screen.getByLabelText("Prompt body"),
      "Ask one concise clarifying question before giving troubleshooting steps.",
    );
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      (await screen.findAllByText("OpenAI triage agent")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Ask one concise clarifying question before giving troubleshooting steps.",
      ),
    ).toBeInTheDocument();
  });

  it("deletes the selected agent prompt inline", async () => {
    const user = userEvent.setup();

    vi.stubGlobal("confirm", vi.fn(() => true));

    renderPage();

    await screen.findByText("OpenAI Session");
    await screen.findAllByText("OpenAI support agent");
    await user.click(screen.getByRole("button", { name: "Delete Prompt" }));

    expect(
      await screen.findByText(
        "Create the first prompt for this provider to unlock live sessions.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("OpenAI support agent")).not.toBeInTheDocument();
  });

  it("creates a prompt without a language and shows auto-detection", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole("tab", { name: "ElevenLabs" }));
    await screen.findByText("ElevenLabs Session");
    await user.click(screen.getByRole("button", { name: "Create Prompt" }));
    await user.type(screen.getByLabelText("Prompt title"), "Multilingual rep");
    await user.clear(screen.getByLabelText("Language"));
    await user.type(
      screen.getByLabelText("Prompt body"),
      "Act as a polite multilingual representative.",
    );
    await user.click(screen.getByRole("button", { name: "Save Prompt" }));

    expect(
      (await screen.findAllByText("Multilingual rep")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Language: Auto-detect")).toBeInTheDocument();
  });
});
