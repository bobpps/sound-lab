import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

interface FakeAudio {
  src: string;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
  triggerEnded: () => void;
}

let audioInstances: FakeAudio[];

function stubAudio() {
  audioInstances = [];
  vi.stubGlobal(
    "Audio",
    vi.fn(function (this: FakeAudio) {
      this.src = "";
      this.play = vi.fn(() => Promise.resolve());
      this.pause = vi.fn();
      this.onended = null;
      this.triggerEnded = () => this.onended?.();
      audioInstances.push(this);
    }),
  );
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
  window.localStorage.clear();
  stubAudio();
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
      if (url.includes("/providers?type=llm")) {
        return jsonResponse([
          {
            id: "anthropic",
            name: "Anthropic",
            type: "llm",
            enabled: true,
            has_key: true,
            created_at: "2024-01-01",
          },
        ]);
      }
      if (url.includes("/llm/anthropic/models")) {
        return jsonResponse(["claude-haiku-4-5"]);
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
    await screen.findByRole("option", { name: "Kore (female)" });
    expect(
      screen.getByRole("button", { name: /synthesize and compare/i }),
    ).toBeDisabled();
  });

  it("has no reference model select", async () => {
    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });
    await screen.findByRole("option", { name: "Kore (female)" });
    expect(screen.queryByLabelText("Reference model")).not.toBeInTheDocument();
  });

  it("synthesizes the reference voice across all three models", async () => {
    const user = userEvent.setup();
    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });

    await screen.findByRole("option", { name: "Kore (female)" });
    await user.selectOptions(screen.getByLabelText("Reference voice"), "Kore");
    await user.selectOptions(screen.getByLabelText("Standard locale"), "en-US");
    await user.type(screen.getByLabelText("Phrase"), "hello");

    await user.click(
      screen.getByRole("button", { name: /synthesize and compare/i }),
    );

    // One reference card per model, all keyed by the model name.
    expect(
      await screen.findByText("gemini-2.5-flash-preview-tts"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("gemini-2.5-pro-preview-tts"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("gemini-3.1-flash-tts-preview"),
    ).toBeInTheDocument();
  });

  it("persists the translation source text on remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<VoiceMatcherPage />, {
      wrapper: createTestWrapper(),
    });

    await screen.findByRole("option", { name: "Anthropic" });
    await user.selectOptions(
      screen.getByLabelText("Translation provider"),
      "anthropic",
    );
    await user.type(screen.getByLabelText("Translate"), "перевести это");

    unmount();

    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });

    // The provider is persisted too, so the textarea restores enabled with text.
    expect(screen.getByLabelText("Translate")).toHaveValue("перевести это");
  });

  it("restores the form from the previous session on remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<VoiceMatcherPage />, {
      wrapper: createTestWrapper(),
    });

    await screen.findByRole("option", { name: "Kore (female)" });
    await user.selectOptions(screen.getByLabelText("Reference voice"), "Kore");
    await user.selectOptions(screen.getByLabelText("Standard locale"), "en-US");
    await user.type(screen.getByLabelText("Phrase"), "remember me");

    unmount();

    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });

    // Text restores synchronously from localStorage; the selects restore once
    // their options have been fetched again.
    expect(screen.getByLabelText("Phrase")).toHaveValue("remember me");
    await screen.findByRole("option", { name: "Kore (female)" });
    expect(screen.getByLabelText("Reference voice")).toHaveValue("Kore");
    expect(screen.getByLabelText("Standard locale")).toHaveValue("en-US");
  });

  it("derives candidates from locale + reference gender", async () => {
    const user = userEvent.setup();
    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });

    await screen.findByRole("option", { name: "Kore (female)" });
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

  it("single-card play does not resume the play-all sequence", async () => {
    const user = userEvent.setup();
    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });

    await screen.findByRole("option", { name: "Kore (female)" });
    await user.selectOptions(screen.getByLabelText("Reference voice"), "Kore");
    await user.selectOptions(screen.getByLabelText("Standard locale"), "en-US");
    await user.type(screen.getByLabelText("Phrase"), "hello");
    await user.click(
      screen.getByRole("button", { name: /synthesize and compare/i }),
    );

    // Wait for both results (reference Kore + candidate en-US-Standard-C) to finish.
    await screen.findByText("en-US-Standard-C");

    // Start "play all" — this installs an onended chaining handler.
    await user.click(
      screen.getByRole("button", { name: /play all in sequence/i }),
    );

    const audio = audioInstances[0];
    expect(audio).toBeDefined();
    expect(audio.onended).not.toBeNull();

    // Now click a single card's play. This must clear the stale onended chain.
    const playButtons = screen.getAllByRole("button", { name: /^play$/i });
    await user.click(playButtons[0]);

    // onended must have been cleared so a single play does NOT advance the queue.
    expect(audio.onended).toBeNull();

    const playCallsBefore = audio.play.mock.calls.length;
    audio.triggerEnded();
    expect(audio.play.mock.calls.length).toBe(playCallsBefore);
  });

  it("completes synthesis under StrictMode (results become playable, not stuck)", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <VoiceMatcherPage />
      </StrictMode>,
      { wrapper: createTestWrapper() },
    );

    await screen.findByRole("option", { name: "Kore (female)" });
    await user.selectOptions(screen.getByLabelText("Reference voice"), "Kore");
    await user.selectOptions(screen.getByLabelText("Standard locale"), "en-US");
    await user.type(screen.getByLabelText("Phrase"), "hello");
    await user.click(
      screen.getByRole("button", { name: /synthesize and compare/i }),
    );

    // The candidate card renders…
    await screen.findByText("en-US-Standard-C");

    // …and synthesis must actually finish: the per-card Play buttons become
    // enabled (status "done") rather than staying stuck on "Synthesizing…".
    // Regression: a reset-on-input effect used to abort the freshly started
    // batch under StrictMode's deferred/double-invoked passive effects.
    await waitFor(() => {
      const playButtons = screen.getAllByRole("button", { name: /^play$/i });
      expect(playButtons.length).toBeGreaterThan(0);
      for (const btn of playButtons) {
        expect(btn).toBeEnabled();
      }
    });
    expect(screen.queryByText("Synthesizing…")).not.toBeInTheDocument();

    // The synth button is usable again once the batch settled.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /synthesize and compare/i }),
      ).toBeEnabled(),
    );
  });

  it("disables the synth button while a batch is running", async () => {
    let resolveSynth: ((value: Response) => void) | undefined;
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
          return new Promise<Response>((resolve) => {
            resolveSynth = resolve;
          });
        }
        return jsonResponse({ message: "Not Found" });
      }),
    );

    const user = userEvent.setup();
    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });

    await screen.findByRole("option", { name: "Kore (female)" });
    await user.selectOptions(screen.getByLabelText("Reference voice"), "Kore");
    await user.selectOptions(screen.getByLabelText("Standard locale"), "en-US");
    await user.type(screen.getByLabelText("Phrase"), "hello");

    const button = screen.getByRole("button", {
      name: /synthesize and compare/i,
    });
    expect(button).toBeEnabled();

    await user.click(button);

    // The batch is in flight (fetch never resolved) -> button disabled.
    await waitFor(() => expect(button).toBeDisabled());

    // Let the in-flight request settle to avoid act warnings.
    resolveSynth?.(new Response(new Blob(["audio"]), { status: 200 }));
  });

  it("surfaces a locale load error when the Standard voices request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/tts/gemini-tts/voices")) {
          return jsonResponse(geminiVoices);
        }
        if (url.includes("/api/tts/google/voices")) {
          return new Response(JSON.stringify({ message: "boom" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return jsonResponse({ message: "Not Found" });
      }),
    );

    render(<VoiceMatcherPage />, { wrapper: createTestWrapper() });

    expect(
      await screen.findByText("Failed to load locales."),
    ).toBeInTheDocument();
  });
});
