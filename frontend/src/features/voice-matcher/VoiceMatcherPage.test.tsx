import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../../test-utils.tsx";
import { VoiceMatcherPage } from "./VoiceMatcherPage.tsx";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const geminiVoices = [
  { id: "Kore", name: "Kore", language: "multi", gender: "female" },
  { id: "Puck", name: "Puck", language: "multi", gender: "male" },
];

const standardVoices = [
  { id: "en-US-Standard-A", name: "en-US-Standard-A", language: "en-US", gender: "male" },
  { id: "en-US-Standard-C", name: "en-US-Standard-C", language: "en-US", gender: "female" },
  { id: "de-DE-Standard-A", name: "de-DE-Standard-A", language: "de-DE", gender: "female" },
];

beforeEach(() => {
  vi.stubGlobal(
    "Audio",
    vi.fn(() => ({
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      set onended(_fn: unknown) {},
      src: "",
    })),
  );
  vi.stubGlobal("URL", {
    ...globalThis.URL,
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/tts/gemini-tts/voices")) {
        return jsonResponse(geminiVoices);
      }
      if (url.includes("/api/tts/google/voices")) {
        return jsonResponse(standardVoices);
      }
      if (url.includes("/synthesize")) {
        return new Response(new Blob(["audio"]), { status: 200 });
      }
      return jsonResponse({ message: "Not Found" });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VoiceMatcherPage", () => {
  it("renders the heading", () => {
    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });
    expect(
      screen.getByRole("heading", { name: "Voice Matcher" }),
    ).toBeInTheDocument();
  });

  it("disables the synth button when text is empty", async () => {
    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });
    await screen.findByRole("option", { name: "Kore" });
    expect(
      screen.getByRole("button", { name: /synthesize and compare/i }),
    ).toBeDisabled();
  });

  it("derives candidates from locale + reference gender", async () => {
    const user = userEvent.setup();
    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });

    await screen.findByRole("option", { name: "Kore" });
    // Kore is female -> exclude male candidates; pick en-US locale.
    await user.selectOptions(screen.getByLabelText("Reference voice"), "Kore");
    await user.selectOptions(screen.getByLabelText("Standard locale"), "en-US");
    await user.type(screen.getByLabelText("Phrase"), "hello");

    await user.click(
      screen.getByRole("button", { name: /synthesize and compare/i }),
    );

    // Female reference -> female + neutral/undefined candidates only.
    expect(await screen.findByText("en-US-Standard-C")).toBeInTheDocument();
    expect(screen.queryByText("en-US-Standard-A")).not.toBeInTheDocument();
  });
});
