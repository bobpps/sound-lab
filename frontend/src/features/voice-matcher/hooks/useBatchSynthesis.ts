import { useEffect, useRef, useState } from "react";

export interface SynthesisJob {
  key: string;
  run: (signal: AbortSignal) => Promise<Blob>;
}

export type ResultStatus = "pending" | "done" | "error";

export interface SynthesisResult {
  status: ResultStatus;
  url?: string;
  error?: string;
}

export type ResultMap = Record<string, SynthesisResult>;

interface UseBatchSynthesisReturn {
  results: ResultMap;
  isRunning: boolean;
  start: (jobs: SynthesisJob[]) => void;
  reset: () => void;
}

export function useBatchSynthesis(concurrency: number): UseBatchSynthesisReturn {
  const [results, setResults] = useState<ResultMap>({});
  const [isRunning, setIsRunning] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);

  function revokeAll() {
    for (const url of urlsRef.current) {
      URL.revokeObjectURL(url);
    }
    urlsRef.current = [];
  }

  function teardown() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    revokeAll();
  }

  function reset() {
    teardown();
    setResults({});
    setIsRunning(false);
  }

  function start(jobs: SynthesisJob[]) {
    teardown();

    if (jobs.length === 0) {
      setResults({});
      setIsRunning(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const initial: ResultMap = {};
    for (const job of jobs) {
      initial[job.key] = { status: "pending" };
    }
    setResults(initial);
    setIsRunning(true);

    let cursor = 0;

    async function worker() {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        try {
          const blob = await job.run(controller.signal);
          if (controller.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          setResults((prev) => ({
            ...prev,
            [job.key]: { status: "done", url },
          }));
        } catch (err: unknown) {
          if (controller.signal.aborted) return;
          setResults((prev) => ({
            ...prev,
            [job.key]: {
              status: "error",
              error: err instanceof Error ? err.message : "Synthesis failed",
            },
          }));
        }
      }
    }

    const pool = Array.from(
      { length: Math.min(concurrency, jobs.length) },
      () => worker(),
    );

    Promise.all(pool).finally(() => {
      if (!controller.signal.aborted) {
        setIsRunning(false);
      }
    });
  }

  // Cleanup on unmount: abort in-flight work and revoke any created blob URLs.
  // Self-contained (refs only) so it needs no dependencies — mirrors
  // features/tts/hooks/useAudioPlayback.ts.
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      for (const url of urlsRef.current) {
        URL.revokeObjectURL(url);
      }
      urlsRef.current = [];
    };
  }, []);

  return { results, isRunning, start, reset };
}
