import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../../../test-utils.tsx";
import { useGeminiVoices, useStandardVoices } from "./queries.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const standardVoices = [
  { id: "en-US-Standard-A", name: "en-US-Standard-A", language: "en-US", gender: "male" },
  { id: "en-US-Standard-C", name: "en-US-Standard-C", language: "en-US", gender: "female" },
];

const geminiVoices = [
  { id: "Kore", name: "Kore", language: "multi", gender: "female" },
  { id: "Puck", name: "Puck", language: "multi", gender: "male" },
];

describe("voice-matcher queries", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/tts/google/voices")) {
          return jsonResponse(standardVoices);
        }
        if (url.includes("/api/tts/gemini-tts/voices")) {
          return jsonResponse(geminiVoices);
        }
        return jsonResponse({ message: "Not Found" }, 404);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useStandardVoices fetches the google Standard list", async () => {
    const { result } = renderHook(() => useStandardVoices(), {
      wrapper: createTestWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(standardVoices);
  });

  it("useGeminiVoices is disabled until a model is provided", () => {
    const { result } = renderHook(() => useGeminiVoices(null), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGeminiVoices fetches voices for the given model", async () => {
    const { result } = renderHook(
      () => useGeminiVoices("gemini-2.5-flash-preview-tts"),
      { wrapper: createTestWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(geminiVoices);
  });
});
