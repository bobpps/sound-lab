import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { AutoAnnotateModal } from "./AutoAnnotateModal.tsx";

const llmProviders = [
  {
    id: "openai",
    name: "OpenAI",
    type: "llm",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

const llmModels = ["gpt-4o", "gpt-4o-mini"];

const annotationPrompts = [
  {
    id: 1,
    title: "Formal style",
    provider_id: "elevenlabs",
    language: "en-US",
    prompt: "Make it formal",
    created_by: null,
    created_at: "2026-04-03T00:00:00.000Z",
  },
  {
    id: 2,
    title: "Wrong provider prompt",
    provider_id: "google",
    language: "en-US",
    prompt: "Different provider",
    created_by: null,
    created_at: "2026-04-03T00:00:00.000Z",
  },
];

const autoAnnotateResult = {
  id: 30,
  dialog_id: 1,
  provider_id: "elevenlabs",
  title: "Auto-annotated",
  created_by: null,
  created_at: "2026-04-05T10:00:00.000Z",
  messages: [
    {
      id: 300,
      annotated_dialog_id: 30,
      dialog_message_id: 1,
      text: "Auto text",
    },
  ],
};

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

describe("AutoAnnotateModal", () => {
  const onClose = vi.fn();
  const onAnnotationCreated = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = extractUrl(input);

        if (url.endsWith("/api/providers?type=llm")) {
          return jsonResponse(llmProviders);
        }

        if (url.endsWith("/api/llm/openai/models")) {
          return jsonResponse(llmModels);
        }

        if (url.endsWith("/api/annotation-prompts")) {
          return jsonResponse(annotationPrompts);
        }

        if (url.endsWith("/api/services/annotate")) {
          return jsonResponse(autoAnnotateResult);
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the modal with LLM provider selector", async () => {
    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Auto-Annotate",
    });
    expect(dialog).toBeInTheDocument();

    expect(
      await within(dialog).findByRole("combobox", { name: /llm provider/i }),
    ).toBeInTheDocument();
  });

  it("shows model selector after LLM provider is selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Auto-Annotate",
    });
    const providerSelect = await within(dialog).findByRole("combobox", {
      name: /llm provider/i,
    });
    await user.selectOptions(providerSelect, "openai");

    expect(
      await within(dialog).findByRole("combobox", { name: /model/i }),
    ).toBeInTheDocument();
  });

  it("filters annotation prompts by ttsProviderId", async () => {
    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Auto-Annotate",
    });

    const promptSelect = await within(dialog).findByRole("combobox", {
      name: /annotation prompt/i,
    });

    // "Formal style" (elevenlabs) should be present
    const options = within(promptSelect).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Formal style");
    // "Wrong provider prompt" (google) should NOT be present
    expect(optionTexts).not.toContain("Wrong provider prompt");
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    await screen.findByRole("dialog", { name: "Auto-Annotate" });
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("submits auto-annotate request with selected values", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AutoAnnotateModal
        dialogId={1}
        ttsProviderId="elevenlabs"
        onClose={onClose}
        onAnnotationCreated={onAnnotationCreated}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Auto-Annotate",
    });

    // Select LLM provider
    const providerSelect = await within(dialog).findByRole("combobox", {
      name: /llm provider/i,
    });
    await user.selectOptions(providerSelect, "openai");

    // Select model
    const modelSelect = await within(dialog).findByRole("combobox", {
      name: /model/i,
    });
    await user.selectOptions(modelSelect, "gpt-4o");

    // Select annotation prompt
    const promptSelect = within(dialog).getByRole("combobox", {
      name: /annotation prompt/i,
    });
    await user.selectOptions(promptSelect, "1");

    // Fill in title
    const titleInput = within(dialog).getByRole("textbox", {
      name: /title/i,
    });
    await user.clear(titleInput);
    await user.type(titleInput, "My auto annotation");

    // Submit
    await user.click(
      within(dialog).getByRole("button", { name: /run auto-annotate/i }),
    );

    await waitFor(() => {
      expect(onAnnotationCreated).toHaveBeenCalledWith(30);
    });
  });
});
