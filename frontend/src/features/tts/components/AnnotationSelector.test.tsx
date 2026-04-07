import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { AnnotationSelector } from "./AnnotationSelector.tsx";

const annotations = [
  {
    id: 10,
    dialog_id: 1,
    provider_id: "openai",
    title: "Formal annotation",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
  {
    id: 11,
    dialog_id: 1,
    provider_id: "openai",
    title: "Casual annotation",
    created_by: null,
    created_at: "2026-04-03T10:00:00.000Z",
  },
  {
    id: 12,
    dialog_id: 1,
    provider_id: "elevenlabs",
    title: "ElevenLabs annotation",
    created_by: null,
    created_at: "2026-04-04T10:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AnnotationSelector", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(annotations)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onSelect.mockReset();
  });

  it("renders annotations with a 'Clean' option and calls onSelect", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        providerId="openai"
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    // "Clean" option should be present
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toContain(
      "Clean (no annotation)",
    );

    await user.selectOptions(select, "10");

    expect(onSelect).toHaveBeenCalledWith(10);
  });

  it("allows selecting the Clean option", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        providerId="openai"
        selectedAnnotationId={10}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    await user.selectOptions(select, "clean");

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("shows loading state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        providerId="openai"
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("Loading annotations...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Server error" }, 500)),
    );

    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        providerId="openai"
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    expect(
      await screen.findByText("Failed to load annotations."),
    ).toBeInTheDocument();
  });

  it("reflects the selected annotation", async () => {
    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        providerId="openai"
        selectedAnnotationId={10}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    expect(select).toHaveValue("10");
  });

  it("only shows annotations for the selected provider", async () => {
    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        providerId="openai"
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    const options = select.querySelectorAll("option");
    const optionTexts = Array.from(options).map((o) => o.textContent);

    expect(optionTexts).toContain("Formal annotation");
    expect(optionTexts).toContain("Casual annotation");
    expect(optionTexts).not.toContain("ElevenLabs annotation");
  });

  it("shows 'Clean' as selected when selectedAnnotationId is null", async () => {
    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        providerId="openai"
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    const select = await screen.findByRole("combobox", {
      name: "Annotation Variant",
    });

    expect(select).toHaveValue("clean");
  });

  it("filters annotations by provider_id", async () => {
    renderWithProviders(
      <AnnotationSelector
        dialogId={1}
        providerId="openai"
        selectedAnnotationId={null}
        onSelect={onSelect}
      />,
    );

    await screen.findByRole("combobox", { name: "Annotation Variant" });

    const options = screen.getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    // Should show openai annotations but not elevenlabs
    expect(optionTexts).toContain("Formal annotation");
    expect(optionTexts).toContain("Casual annotation");
    expect(optionTexts).not.toContain("ElevenLabs annotation");
  });
});
