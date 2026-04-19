import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider, ProviderKeyTestResponse, ProviderType } from "../../../types/api.ts";
import { ProvidersPage } from "./ProvidersPage.tsx";

const baseProviderState: Record<ProviderType, Provider[]> = {
  tts: [
    {
      id: "google",
      name: "Google",
      type: "tts",
      enabled: true,
      has_key: true,
      created_at: "2026-04-06T00:00:00.000Z",
    },
  ],
  llm: [
    {
      id: "openai",
      name: "OpenAI",
      type: "llm",
      enabled: true,
      has_key: false,
      created_at: "2026-04-06T00:00:00.000Z",
    },
  ],
  realtime: [
    {
      id: "openai-realtime",
      name: "OpenAI Realtime",
      type: "realtime",
      enabled: true,
      has_key: true,
      created_at: "2026-04-06T00:00:00.000Z",
    },
  ],
};

let providerState: Record<ProviderType, Provider[]>;

let validationState: Record<string, ProviderKeyTestResponse>;

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
    providerState = JSON.parse(JSON.stringify(baseProviderState)) as Record<ProviderType, Provider[]>;
    validationState = {
      google: {
        provider_id: "google",
        status: "valid",
        message: "Saved API key is active.",
        checked_at: "2026-04-06T00:00:00.000Z",
      },
      "openai-realtime": {
        provider_id: "openai-realtime",
        status: "valid",
        message: "Saved API key is active.",
        checked_at: "2026-04-06T00:00:00.000Z",
      },
    };

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
        providerState.tts[0] = { ...providerState.tts[0], has_key: true };
        validationState.google = {
          provider_id: "google",
          status: "valid",
          message: "Saved API key is active.",
          checked_at: "2026-04-06T00:01:00.000Z",
        };
        return noContentResponse();
      }

      if (method === "POST" && url.endsWith("/providers/google/key/test")) {
        return jsonResponse(validationState.google);
      }

      if (method === "POST" && url.endsWith("/providers/openai-realtime/key/test")) {
        return jsonResponse(validationState["openai-realtime"]);
      }

      return jsonResponse({ message: `Unhandled request: ${method} ${url}` }, 500);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("loads providers, validates saved keys, and skips providers without keys", async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText("Google")).toBeInTheDocument();
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/providers/google/key/test",
      expect.objectContaining({ method: "POST" }),
    );

    await user.click(screen.getByRole("tab", { name: "LLM" }));

    expect(await screen.findByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test OpenAI API key" })).toBeDisabled();
    expect(screen.getByText("Add a key to test it.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/providers?type=llm",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/providers/openai/key/test",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("updates provider enabled state, saves an API key, and validates it", async () => {
    const user = userEvent.setup();
    providerState.tts[0] = { ...providerState.tts[0], has_key: false };

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

    expect(screen.getByText("Not configured")).toBeInTheDocument();

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

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/providers/google/key/test",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Active")).toBeInTheDocument();
  });

  it("manually tests a saved key and shows provider problems", async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText("Active")).toBeInTheDocument();

    validationState.google = {
      provider_id: "google",
      status: "invalid",
      message: "The saved API key was rejected or lacks required access.",
      checked_at: "2026-04-06T00:02:00.000Z",
    };

    await user.click(screen.getByRole("button", { name: "Test Google API key" }));

    expect(await screen.findByText("Problem")).toBeInTheDocument();
    expect(screen.getByText("The saved API key was rejected or lacks required access.")).toBeInTheDocument();
  });

  it("tests every configured provider in the active tab", async () => {
    const user = userEvent.setup();
    providerState.tts = [
      ...providerState.tts,
      {
        id: "elevenlabs",
        name: "ElevenLabs",
        type: "tts",
        enabled: true,
        has_key: true,
        created_at: "2026-04-06T00:00:00.000Z",
      },
    ];
    validationState.elevenlabs = {
      provider_id: "elevenlabs",
      status: "valid",
      message: "Saved API key is active.",
      checked_at: "2026-04-06T00:03:00.000Z",
    };
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.endsWith("/providers?type=tts")) {
        return jsonResponse(providerState.tts);
      }

      if (method === "POST" && url.endsWith("/providers/google/key/test")) {
        return jsonResponse(validationState.google);
      }

      if (method === "POST" && url.endsWith("/providers/elevenlabs/key/test")) {
        return jsonResponse(validationState.elevenlabs);
      }

      return jsonResponse({ message: `Unhandled request: ${method} ${url}` }, 500);
    });

    renderPage();

    expect(await screen.findByText("ElevenLabs")).toBeInTheDocument();
    fetchMock.mockClear();

    await user.click(screen.getByRole("button", { name: "Test All" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/providers/google/key/test",
        expect.objectContaining({ method: "POST" }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/providers/elevenlabs/key/test",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows a generic error state for unexpected query failures", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));

    renderPage();

    expect(
      await screen.findByText("Unable to load providers right now."),
    ).toBeInTheDocument();
  });
});
