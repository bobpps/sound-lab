import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "../../../types/api.ts";
import { ProvidersPage } from "./ProvidersPage.tsx";

const providerState: Record<string, Provider[]> = {
  tts: [
    {
      id: "google",
      name: "Google",
      type: "tts",
      enabled: true,
      created_at: "2026-04-06T00:00:00.000Z",
    },
  ],
  llm: [
    {
      id: "openai",
      name: "OpenAI",
      type: "llm",
      enabled: true,
      created_at: "2026-04-06T00:00:00.000Z",
    },
  ],
  realtime: [
    {
      id: "openai-realtime",
      name: "OpenAI Realtime",
      type: "realtime",
      enabled: true,
      created_at: "2026-04-06T00:00:00.000Z",
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function noContentResponse() {
  return new Response(null, { status: 204 });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProvidersPage />
    </QueryClientProvider>,
  );
}

describe("ProvidersPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.endsWith("/providers?type=tts")) {
        return jsonResponse(providerState.tts);
      }

      if (method === "GET" && url.endsWith("/providers?type=llm")) {
        return jsonResponse(providerState.llm);
      }

      if (method === "GET" && url.endsWith("/providers?type=realtime")) {
        return jsonResponse(providerState.realtime);
      }

      if (method === "PUT" && url.endsWith("/providers/google")) {
        providerState.tts[0] = { ...providerState.tts[0], enabled: false };
        return jsonResponse(providerState.tts[0]);
      }

      if (method === "PUT" && url.endsWith("/providers/google/key")) {
        return noContentResponse();
      }

      return jsonResponse({ message: `Unhandled request: ${method} ${url}` }, 500);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();

    providerState.tts[0] = { ...providerState.tts[0], enabled: true };
  });

  it("loads TTS providers by default and switches to the LLM tab", async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText("Google")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "LLM" }));

    expect(await screen.findByText("OpenAI")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/providers?type=llm",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("updates provider enabled state and saves an API key", async () => {
    const user = userEvent.setup();

    renderPage();

    const toggle = await screen.findByRole("checkbox");
    expect(toggle).toBeChecked();

    await user.click(toggle);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/providers/google",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ enabled: false }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Set API Key" }));
    await user.type(screen.getByLabelText("API key"), "sk-secret-123");
    await user.click(screen.getByRole("button", { name: "Save API Key" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/providers/google/key",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ key: "sk-secret-123" }),
        }),
      );
    });
  });
});
