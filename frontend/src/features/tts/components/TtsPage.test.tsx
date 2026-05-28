import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { TtsPage } from "./TtsPage.tsx";

const providers = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    type: "tts",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

const dialogs = [
  {
    id: 1,
    title: "Greeting practice",
    description: null,
    language: "en-US",
    created_by: null,
    created_at: "2026-04-01T10:00:00.000Z",
  },
];

const annotations = [
  {
    id: 10,
    dialog_id: 1,
    provider_id: "elevenlabs",
    title: "Formal annotation",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

const annotationWithMessages = {
  ...annotations[0],
  messages: [
    { id: 100, annotated_dialog_id: 10, dialog_message_id: 50, text: "Hello there." },
    { id: 101, annotated_dialog_id: 10, dialog_message_id: 51, text: "Hi, how are you?" },
  ],
};

const dialogWithMessages = {
  ...dialogs[0],
  messages: [
    { id: 50, dialog_id: 1, order: 1, character: 1 as const, text: "Hello there." },
    { id: 51, dialog_id: 1, order: 2, character: 2 as const, text: "Hi, how are you?" },
  ],
};

const voices = [
  { id: "voice-1", name: "Alice", language: "en-US", gender: "female" },
  { id: "voice-2", name: "Bob", language: "en-US", gender: "male" },
];

const ttsModels = ["eleven_multilingual_v2"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

describe("TtsPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(providers);
        }

        if (url.endsWith("/api/dialogs") && !url.includes("/1")) {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs/1/annotations")) {
          return jsonResponse(annotations);
        }

        if (url.endsWith("/api/annotations/10")) {
          return jsonResponse(annotationWithMessages);
        }

        if (url.endsWith("/api/dialogs/1") && !url.includes("annotations")) {
          return jsonResponse(dialogWithMessages);
        }

        if (url.endsWith("/api/tts/elevenlabs/models")) {
          return jsonResponse(ttsModels);
        }

        if (url.endsWith("/api/tts/elevenlabs/voices?model=eleven_multilingual_v2")) {
          return jsonResponse(voices);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the page title", async () => {
    renderWithProviders(<TtsPage />);

    expect(
      screen.getByRole("heading", { name: "TTS Testing" }),
    ).toBeInTheDocument();
  });

  it("shows only provider selector initially, dialog and annotation are hidden", async () => {
    renderWithProviders(<TtsPage />);

    expect(
      await screen.findByRole("combobox", { name: "TTS Provider" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("combobox", { name: "Dialog" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("combobox", { name: "Annotation Variant" }),
    ).not.toBeInTheDocument();
  });

  it("shows dialog selector after selecting a provider", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    expect(
      await screen.findByRole("combobox", { name: "Dialog" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("combobox", { name: "Annotation Variant" }),
    ).not.toBeInTheDocument();
  });

  it("shows annotation selector after selecting a dialog", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    expect(
      await screen.findByRole("combobox", { name: "Annotation Variant" }),
    ).toBeInTheDocument();
  });

  it("shows model selector after selecting a dialog", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    expect(
      await screen.findByRole("combobox", { name: "TTS Model" }),
    ).toBeInTheDocument();
  });

  it("resets dialog and annotation when provider changes", async () => {
    const user = userEvent.setup();

    // Add a second provider to enable switching
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse([
            ...providers,
            {
              id: "google",
              name: "Google",
              type: "tts",
              enabled: true,
              created_at: "2026-04-06T00:00:00.000Z",
            },
          ]);
        }

        if (url.endsWith("/api/dialogs")) {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs/1/annotations")) {
          return jsonResponse(annotations);
        }

        if (url.endsWith("/api/tts/elevenlabs/models")) {
          return jsonResponse(ttsModels);
        }

        if (url.endsWith("/api/tts/google/models")) {
          return jsonResponse(["Chirp3-HD"]);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );

    renderWithProviders(<TtsPage />);

    // Select provider and dialog
    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    // Verify annotation selector appeared
    expect(
      await screen.findByRole("combobox", { name: "Annotation Variant" }),
    ).toBeInTheDocument();

    // Change provider — should reset dialog and annotation
    await user.selectOptions(providerSelect, "google");

    // Dialog selector should still be visible (new provider selected)
    // but annotation selector should be gone (dialog was reset)
    expect(
      screen.getByRole("combobox", { name: "Dialog" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Annotation Variant" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "TTS Model" }),
    ).not.toBeInTheDocument();
  });

  it("resets annotation when dialog changes", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=tts")) {
          return jsonResponse(providers);
        }

        if (url.endsWith("/api/dialogs")) {
          return jsonResponse([
            ...dialogs,
            {
              id: 2,
              title: "Second dialog",
              description: null,
              language: "en-GB",
              created_by: null,
              created_at: "2026-04-03T10:00:00.000Z",
            },
          ]);
        }

        if (url.includes("/annotations")) {
          return jsonResponse(annotations);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    // Wait for annotation selector to appear
    await screen.findByRole("combobox", { name: "Annotation Variant" });

    // Select an annotation
    const annotationSelect = screen.getByRole("combobox", {
      name: "Annotation Variant",
    });
    await user.selectOptions(annotationSelect, "10");

    // Change dialog — annotation selector should reset
    await user.selectOptions(dialogSelect, "2");

    // Annotation selector should still be visible but reset to "Clean"
    const newAnnotationSelect = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });
    expect(newAnnotationSelect).toHaveValue("clean");
  });

  it("shows voice assignment after selecting provider and dialog", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    const modelSelect = await screen.findByRole("combobox", {
      name: "TTS Model",
    });
    await user.selectOptions(modelSelect, "eleven_multilingual_v2");

    // Voice assignment should appear (voices load for the selected provider and model)
    expect(
      await screen.findByLabelText("Character 1 voice"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Character 2 voice")).toBeInTheDocument();
  });

  it("shows dialog lines and Run button with clean (no annotation) selection", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    // Default is "Clean (no annotation)" — original dialog messages should show
    await waitFor(() => {
      expect(screen.getByText("Hello there.")).toBeInTheDocument();
      expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
    });

    // Run button should be present but disabled (no voices assigned)
    expect(
      screen.getByRole("button", { name: /run/i }),
    ).toBeDisabled();
  });

  it("shows Run button disabled until voices are assigned", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    // Select a specific annotation
    const annotationSelect = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });
    await user.selectOptions(annotationSelect, "10");

    // Wait for messages to load (multiple elements match because AnnotationEditor also renders the text)
    await waitFor(() => {
      expect(screen.getAllByText("Hello there.").length).toBeGreaterThan(0);
    });

    expect(
      screen.getByRole("button", { name: /run/i }),
    ).toBeDisabled();
  });

  it("shows annotation editor when an annotation variant is selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    const annotationSelect = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });
    await user.selectOptions(annotationSelect, "10");

    // Editor should appear
    expect(
      await screen.findByRole("heading", { name: "Annotation Editor" }),
    ).toBeInTheDocument();
  });

  it("hides annotation editor when Clean variant is selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TtsPage />);

    const providerSelect = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });
    await user.selectOptions(providerSelect, "elevenlabs");

    const dialogSelect = await screen.findByRole("combobox", {
      name: "Dialog",
    });
    await user.selectOptions(dialogSelect, "1");

    const annotationSelect = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });
    await user.selectOptions(annotationSelect, "10");

    // Editor should appear
    await screen.findByRole("heading", { name: "Annotation Editor" });

    // Switch back to "Clean"
    await user.selectOptions(annotationSelect, "clean");

    // Editor should disappear
    expect(
      screen.queryByRole("heading", { name: "Annotation Editor" }),
    ).not.toBeInTheDocument();
  });
});
