import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../../../test-utils.tsx";
import { TranslatePanel } from "./TranslatePanel.tsx";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const providers = [
  {
    id: "anthropic",
    name: "Anthropic",
    type: "llm",
    enabled: true,
    has_key: true,
    created_at: "2024-01-01",
  },
  // Active but no key -> must be hidden.
  {
    id: "openai",
    name: "OpenAI",
    type: "llm",
    enabled: true,
    has_key: false,
    created_at: "2024-01-01",
  },
  // Has key but disabled -> must be hidden.
  {
    id: "disabled",
    name: "Disabled Co",
    type: "llm",
    enabled: false,
    has_key: true,
    created_at: "2024-01-01",
  },
];

const anthropicModels = ["claude-sonnet-4-5-20250929", "claude-3-5-haiku-20241022"];

let completeBody: Record<string, unknown> | null;

function stubFetch() {
  completeBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/providers?type=llm")) {
        return jsonResponse(providers);
      }
      if (url.includes("/llm/anthropic/models")) {
        return jsonResponse(anthropicModels);
      }
      if (url.includes("/llm/anthropic/complete")) {
        completeBody = JSON.parse(String(init?.body));
        return jsonResponse({ text: "Hallo Welt" });
      }
      return jsonResponse({ message: "Not Found" });
    }),
  );
}

/** Harness that owns the (lifted) provider + source-text state. */
function Harness({ onTranslated }: { onTranslated: (text: string) => void }) {
  const [providerId, setProviderId] = useState<string | null>(null);
  const [source, setSource] = useState("");
  return (
    <TranslatePanel
      targetLocale="de-DE"
      providerId={providerId}
      onProviderChange={setProviderId}
      source={source}
      onSourceChange={setSource}
      onTranslated={onTranslated}
    />
  );
}

describe("TranslatePanel", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists only active providers that have a key", async () => {
    render(<Harness onTranslated={() => {}} />, { wrapper: createTestWrapper() });

    expect(
      await screen.findByRole("option", { name: "Anthropic" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "OpenAI" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Disabled Co" }),
    ).not.toBeInTheDocument();
  });

  it("disables the textarea until a provider is selected", async () => {
    const user = userEvent.setup();
    render(<Harness onTranslated={() => {}} />, { wrapper: createTestWrapper() });

    await screen.findByRole("option", { name: "Anthropic" });
    expect(screen.getByLabelText("Translate")).toBeDisabled();

    await user.selectOptions(
      screen.getByLabelText("Translation provider"),
      "anthropic",
    );
    expect(screen.getByLabelText("Translate")).toBeEnabled();
  });

  it("translates with the cheap model and reports the result", async () => {
    const onTranslated = vi.fn();
    const user = userEvent.setup();
    render(<Harness onTranslated={onTranslated} />, {
      wrapper: createTestWrapper(),
    });

    await screen.findByRole("option", { name: "Anthropic" });
    await user.selectOptions(
      screen.getByLabelText("Translation provider"),
      "anthropic",
    );
    await user.type(screen.getByLabelText("Translate"), "Hello world");
    await user.click(
      screen.getByRole("button", { name: /translate into phrase/i }),
    );

    await waitFor(() => expect(onTranslated).toHaveBeenCalledWith("Hallo Welt"));

    // Cheap model picked (haiku, not the flagship sonnet).
    expect(completeBody?.model).toBe("claude-3-5-haiku-20241022");
    const messages = completeBody?.messages as Array<{
      role: string;
      content: string;
    }>;
    expect(messages.at(-1)).toEqual({ role: "user", content: "Hello world" });
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("de-DE");
  });
});
