import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api-client.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("omits JSON content type for bodyless POST requests", async () => {
    await api.post<{ ok: boolean }>("/providers/google/key/test");

    const init = fetchMock.mock.calls[0]?.[1];

    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        body: undefined,
      }),
    );
    expect(init?.headers).toEqual({ "Accept": "application/json" });
  });

  it("sends JSON content type and serialized payload for POST requests with a body", async () => {
    const body = { title: "Fresh dialog", language: "en-US" };

    await api.post<{ ok: boolean }>("/dialogs", body);

    const init = fetchMock.mock.calls[0]?.[1];

    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      "Accept": "application/json",
    });
  });

  it("omits JSON content type for bodyless PUT requests", async () => {
    await api.put<{ ok: boolean }>("/providers/google");

    const init = fetchMock.mock.calls[0]?.[1];

    expect(init).toEqual(
      expect.objectContaining({
        method: "PUT",
        body: undefined,
      }),
    );
    expect(init?.headers).toEqual({ "Accept": "application/json" });
  });
});
