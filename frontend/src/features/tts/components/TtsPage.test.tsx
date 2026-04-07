import { screen } from "@testing-library/react";
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
    provider_id: "openai",
    title: "Formal annotation",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

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

        if (url.endsWith("/api/dialogs")) {
          return jsonResponse(dialogs);
        }

        if (url.endsWith("/api/dialogs/1/annotations")) {
          return jsonResponse(annotations);
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
});
