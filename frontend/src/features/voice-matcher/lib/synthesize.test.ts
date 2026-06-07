import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../lib/api-client.ts";
import { synthesizeCandidate, synthesizeReference } from "./synthesize.ts";

describe("voice-matcher synthesize", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(
      async () =>
        new Response(new Blob(["audio"], { type: "audio/wav" }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("synthesizeReference posts to gemini-tts with model and no format", async () => {
    const controller = new AbortController();
    await synthesizeReference("Kore", "hello", "gemini-2.5-flash-preview-tts", controller.signal);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/tts/gemini-tts/synthesize");
    expect(JSON.parse(opts.body as string)).toEqual({
      voiceId: "Kore",
      text: "hello",
      model: "gemini-2.5-flash-preview-tts",
    });
  });

  it("synthesizeCandidate posts to google with LINEAR16 format", async () => {
    const controller = new AbortController();
    await synthesizeCandidate("en-US-Standard-A", "hello", controller.signal);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/tts/google/synthesize");
    expect(JSON.parse(opts.body as string)).toEqual({
      voiceId: "en-US-Standard-A",
      text: "hello",
      format: "LINEAR16",
    });
  });

  it("throws an ApiError preserving status and server message on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const controller = new AbortController();
    const err = await synthesizeCandidate(
      "en-US-Standard-A",
      "hi",
      controller.signal,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).message).toBe("boom");
  });
});
