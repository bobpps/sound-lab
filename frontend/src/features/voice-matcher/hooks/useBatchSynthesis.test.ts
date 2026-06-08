import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useBatchSynthesis,
  type SynthesisJob,
} from "./useBatchSynthesis.ts";

let created: string[];
let revoked: string[];
let urlCounter: number;

beforeEach(() => {
  created = [];
  revoked = [];
  urlCounter = 0;
  vi.stubGlobal("URL", {
    ...globalThis.URL,
    createObjectURL: vi.fn(() => {
      const url = `blob:mock-${urlCounter++}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => revoked.push(url)),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeJob(key: string, blob = new Blob(["x"])): SynthesisJob {
  return { key, run: vi.fn(async () => blob) };
}

describe("useBatchSynthesis", () => {
  it("synthesizes all jobs and creates a blob URL per success", async () => {
    const jobs = [makeJob("a"), makeJob("b"), makeJob("c")];
    const { result } = renderHook(() => useBatchSynthesis(2));

    act(() => result.current.start(jobs));

    await waitFor(() =>
      expect(
        ["a", "b", "c"].every(
          (k) => result.current.results[k]?.status === "done",
        ),
      ).toBe(true),
    );
    expect(created).toHaveLength(3);
    for (const k of ["a", "b", "c"]) {
      expect(result.current.results[k].url).toMatch(/^blob:mock-/);
    }
  });

  it("never runs more than the concurrency limit at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const makeSlow = (key: string): SynthesisJob => ({
      key,
      run: vi.fn(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return new Blob(["x"]);
      }),
    });
    const jobs = ["a", "b", "c", "d", "e"].map(makeSlow);
    const { result } = renderHook(() => useBatchSynthesis(2));

    act(() => result.current.start(jobs));

    await waitFor(() =>
      expect(
        jobs.every((j) => result.current.results[j.key]?.status === "done"),
      ).toBe(true),
    );
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("isolates a failing job — others still succeed", async () => {
    const ok1 = makeJob("a");
    const bad: SynthesisJob = {
      key: "b",
      run: vi.fn(async () => {
        throw new Error("synth failed");
      }),
    };
    const ok2 = makeJob("c");
    const { result } = renderHook(() => useBatchSynthesis(3));

    act(() => result.current.start([ok1, bad, ok2]));

    await waitFor(() =>
      expect(result.current.results.b?.status).toBe("error"),
    );
    expect(result.current.results.a.status).toBe("done");
    expect(result.current.results.c.status).toBe("done");
    expect(result.current.results.b.error).toBe("synth failed");
  });

  it("reset revokes all created blob URLs", async () => {
    const jobs = [makeJob("a"), makeJob("b")];
    const { result } = renderHook(() => useBatchSynthesis(2));

    act(() => result.current.start(jobs));
    await waitFor(() =>
      expect(result.current.results.b?.status).toBe("done"),
    );

    act(() => result.current.reset());
    expect(revoked).toEqual(expect.arrayContaining(created));
    expect(result.current.results).toEqual({});
  });
});
