import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { AnnotationEditor } from "./AnnotationEditor.tsx";

const dialogMessages = [
  { id: 1, dialog_id: 1, order: 1, character: 1, text: "Hello there" },
  { id: 2, dialog_id: 1, order: 2, character: 2, text: "Hi, how are you?" },
];

const annotatedMessages = [
  {
    id: 100,
    annotated_dialog_id: 10,
    dialog_message_id: 1,
    text: "Good morning",
  },
  {
    id: 101,
    annotated_dialog_id: 10,
    dialog_message_id: 2,
    text: "Hello, how do you do?",
  },
];

const annotationWithMessages = {
  id: 10,
  dialog_id: 1,
  provider_id: "elevenlabs",
  title: "Formal",
  created_by: null,
  created_at: "2026-04-02T10:00:00.000Z",
  messages: annotatedMessages,
};

const dialogWithMessages = {
  id: 1,
  title: "Greeting",
  description: null,
  language: "en-US",
  created_by: null,
  created_at: "2026-04-01T10:00:00.000Z",
  messages: dialogMessages,
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

function extractMethod(
  input: string | URL | Request,
  init?: RequestInit,
): string {
  if (init?.method) return init.method;
  if (input instanceof Request) return input.method;
  return "GET";
}

describe("AnnotationEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = extractUrl(input);
        const method = extractMethod(input, init);

        if (url.endsWith("/api/annotations/10") && method === "GET") {
          return jsonResponse(annotationWithMessages);
        }

        if (url.endsWith("/api/dialogs/1") && method === "GET") {
          return jsonResponse(dialogWithMessages);
        }

        if (
          url.match(/\/api\/annotations\/\d+\/messages\/\d+/) &&
          method === "PUT"
        ) {
          const body = JSON.parse(init?.body as string);
          return jsonResponse({ ...annotatedMessages[0], ...body });
        }

        if (
          url.match(/\/api\/annotations\/\d+\/messages$/) &&
          method === "POST"
        ) {
          const body = JSON.parse(init?.body as string);
          return jsonResponse(
            { id: 200, annotated_dialog_id: 10, ...body },
            201,
          );
        }

        if (
          url.match(/\/api\/dialogs\/\d+\/annotations$/) &&
          method === "POST"
        ) {
          const body = JSON.parse(init?.body as string);
          return jsonResponse(
            {
              id: 20,
              dialog_id: 1,
              ...body,
              created_by: null,
              created_at: "2026-04-02T10:00:00.000Z",
            },
            201,
          );
        }

        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders paired original and annotated messages", async () => {
    renderWithProviders(
      <AnnotationEditor
        annotationId={10}
        dialogId={1}
        ttsProviderId="elevenlabs"
      />,
    );

    // Original messages shown as read-only
    expect(await screen.findByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();

    // Annotated messages shown in editable inputs
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("Good morning");
    expect(inputs[1]).toHaveValue("Hello, how do you do?");
  });

  it("debounces auto-save when annotated text is edited", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(
      <AnnotationEditor
        annotationId={10}
        dialogId={1}
        ttsProviderId="elevenlabs"
      />,
    );

    const inputs = await screen.findAllByRole("textbox");
    await user.clear(inputs[0]);
    await user.type(inputs[0], "Greetings");

    // Not yet called — debounce hasn't fired
    const putCalls = vi.mocked(fetch).mock.calls.filter(
      ([url, init]) =>
        extractUrl(url).includes("/messages/") &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCalls).toHaveLength(0);

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(600);

    await waitFor(() => {
      const putCallsAfter = vi.mocked(fetch).mock.calls.filter(
        ([url, init]) =>
          extractUrl(url).includes("/messages/") &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(putCallsAfter.length).toBeGreaterThan(0);
    });
  });

  it("shows Save as New Variant button", async () => {
    renderWithProviders(
      <AnnotationEditor
        annotationId={10}
        dialogId={1}
        ttsProviderId="elevenlabs"
      />,
    );

    expect(
      await screen.findByRole("button", { name: /save as new variant/i }),
    ).toBeInTheDocument();
  });

  it("shows Auto-Annotate button", async () => {
    renderWithProviders(
      <AnnotationEditor
        annotationId={10}
        dialogId={1}
        ttsProviderId="elevenlabs"
      />,
    );

    expect(
      await screen.findByRole("button", { name: /auto-annotate/i }),
    ).toBeInTheDocument();
  });
});
