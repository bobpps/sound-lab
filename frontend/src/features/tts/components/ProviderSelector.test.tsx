import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { ProviderSelector } from "./ProviderSelector.tsx";

const providers = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    type: "tts",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
  {
    id: "google",
    name: "Google",
    type: "tts",
    enabled: true,
    created_at: "2026-04-06T00:00:00.000Z",
  },
  {
    id: "disabled-provider",
    name: "Disabled TTS",
    type: "tts",
    enabled: false,
    created_at: "2026-04-06T00:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ProviderSelector", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(providers)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onSelect.mockReset();
  });

  it("renders enabled providers as options and calls onSelect", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ProviderSelector selectedId={null} onSelect={onSelect} />,
    );

    const select = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });

    expect(select).toBeInTheDocument();

    await user.selectOptions(select, "elevenlabs");

    expect(onSelect).toHaveBeenCalledWith("elevenlabs");
  });

  it("only shows enabled providers", async () => {
    renderWithProviders(
      <ProviderSelector selectedId={null} onSelect={onSelect} />,
    );

    await screen.findByRole("combobox", { name: "TTS Provider" });

    const options = screen.getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("ElevenLabs");
    expect(optionTexts).toContain("Google");
    expect(optionTexts).not.toContain("Disabled TTS");
  });

  it("shows loading state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    renderWithProviders(
      <ProviderSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(screen.getByText("Loading providers...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Server error" }, 500)),
    );

    renderWithProviders(
      <ProviderSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(
      await screen.findByText("Failed to load providers."),
    ).toBeInTheDocument();
  });

  it("reflects the selected provider", async () => {
    renderWithProviders(
      <ProviderSelector selectedId="google" onSelect={onSelect} />,
    );

    const select = await screen.findByRole("combobox", {
      name: "TTS Provider",
    });

    expect(select).toHaveValue("google");
  });
});
