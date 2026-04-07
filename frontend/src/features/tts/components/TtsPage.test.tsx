import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { TtsPage } from "./TtsPage.tsx";

const ttsProviders = [
  { id: "google", name: "Google", type: "tts" as const, enabled: true, created_at: "2026-04-03T09:00:00.000Z" },
  { id: "elevenlabs", name: "ElevenLabs", type: "tts" as const, enabled: true, created_at: "2026-04-03T09:00:00.000Z" },
];

const dialogs = [
  { id: 10, title: "Greeting dialog", description: null, language: "en-US", created_by: null, created_at: "2026-04-03T10:00:00.000Z" },
];

const annotations = [
  { id: 1, dialog_id: 10, provider_id: "google", title: "Narration v1", created_by: null, created_at: "2026-04-03T10:00:00.000Z" },
];

const annotationWithMessages = {
  ...annotations[0],
  messages: [
    { id: 100, annotated_dialog_id: 1, dialog_message_id: 50, text: "Hello there." },
    { id: 101, annotated_dialog_id: 1, dialog_message_id: 51, text: "Hi, how are you?" },
  ],
};

const dialogWithMessages = {
  ...dialogs[0],
  messages: [
    { id: 50, dialog_id: 10, order: 1, character: 1 as const, text: "Hello there." },
    { id: 51, dialog_id: 10, order: 2, character: 2 as const, text: "Hi, how are you?" },
  ],
};

const voices = [
  { id: "voice-1", name: "Alice", language: "en-US", gender: "female" },
  { id: "voice-2", name: "Bob", language: "en-US", gender: "male" },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname + input.search;
  return input.url;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = extractUrl(input);

      if (url === "/api/providers?type=tts") return jsonResponse(ttsProviders);
      if (url === "/api/dialogs") return jsonResponse(dialogs);
      if (url === "/api/dialogs/10/annotations") return jsonResponse(annotations);
      if (url === "/api/annotations/1") return jsonResponse(annotationWithMessages);
      if (url === "/api/dialogs/10") return jsonResponse(dialogWithMessages);
      if (url === "/api/tts/google/voices") return jsonResponse(voices);
      if (url === "/api/tts/elevenlabs/voices") return jsonResponse(voices);

      return jsonResponse({ message: "Not Found" }, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TtsPage", () => {
  it("renders the page title and description", async () => {
    renderWithProviders(<TtsPage />);

    expect(screen.getByRole("heading", { name: /tts testing/i })).toBeInTheDocument();
    expect(screen.getByText(/test text-to-speech/i)).toBeInTheDocument();
  });

  it("loads and shows TTS provider options", async () => {
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    });

    const providerSelect = screen.getByLabelText(/provider/i);
    expect(providerSelect).toBeInTheDocument();
  });

  it("shows dialog dropdown after provider is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Google" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/provider/i), "google");

    await waitFor(() => {
      expect(screen.getByLabelText(/dialog/i)).toBeInTheDocument();
    });
  });

  it("shows annotation dropdown after dialog is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Google" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/provider/i), "google");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Greeting dialog" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/dialog/i), "10");

    await waitFor(() => {
      expect(screen.getByLabelText(/annotation/i)).toBeInTheDocument();
    });
  });

  it("shows voice assignment and messages after annotation is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Google" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/provider/i), "google");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Greeting dialog" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/dialog/i), "10");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Narration v1" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/annotation/i), "1");

    await waitFor(() => {
      expect(screen.getByText("Hello there.")).toBeInTheDocument();
      expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Character 1 voice")).toBeInTheDocument();
    expect(screen.getByLabelText("Character 2 voice")).toBeInTheDocument();
  });

  it("shows Run button disabled until voices are assigned", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TtsPage />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Google" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/provider/i), "google");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Greeting dialog" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/dialog/i), "10");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Narration v1" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/annotation/i), "1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });
});
