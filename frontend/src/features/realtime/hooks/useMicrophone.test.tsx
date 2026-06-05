import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMicrophone } from "./useMicrophone.ts";

interface FakeWorkletMessage {
  data: {
    sampleRate: number;
    samples: Float32Array;
    type?: string;
  };
}

class FakeAudioWorkletPort {
  onmessage: ((event: FakeWorkletMessage) => void) | null = null;
  deferFlush = false;
  flushSamples = new Float32Array(0);
  postMessage = vi.fn((message: { type?: string }) => {
    if (message.type === "flush") {
      if (this.deferFlush) {
        return;
      }

      this.flush();
    }
  });

  flush() {
    this.onmessage?.({
      data: {
        sampleRate: 16_000,
        samples: this.flushSamples,
        type: "flushed",
      },
    });
  }
}

class FakeAudioWorkletNode {
  static instance: FakeAudioWorkletNode | null = null;
  static shouldThrow = false;

  readonly port = new FakeAudioWorkletPort();
  disconnect = vi.fn();

  constructor() {
    if (FakeAudioWorkletNode.shouldThrow) {
      throw new Error("Unable to create worklet node");
    }

    FakeAudioWorkletNode.instance = this;
  }
}

class FakeMediaStreamSourceNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

function TestHarness({
  onChunk,
  targetSampleRate,
}: {
  onChunk: (chunk: Uint8Array) => void;
  targetSampleRate?: number;
}) {
  const microphone = useMicrophone();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void microphone.start({ onChunk, targetSampleRate });
        }}
      >
        Start
      </button>
      <button
        type="button"
        onClick={() => {
          void microphone.stop();
        }}
      >
        Stop
      </button>
      <span data-testid="chunk-count">{microphone.chunks.length}</span>
      {microphone.error ? <span role="alert">{microphone.error}</span> : null}
    </div>
  );
}

function HookProbe({
  onRender,
}: {
  onRender: (microphone: ReturnType<typeof useMicrophone>) => void;
}) {
  const microphone = useMicrophone();
  onRender(microphone);
  return null;
}

describe("useMicrophone", () => {
  const getUserMedia = vi.fn<() => Promise<MediaStream>>();
  const trackStop = vi.fn();
  const addModule = vi.fn();
  const decodeAudioData = vi.fn();
  let sourceNode: FakeMediaStreamSourceNode;

  beforeEach(() => {
    FakeAudioWorkletNode.instance = null;
    FakeAudioWorkletNode.shouldThrow = false;
    sourceNode = new FakeMediaStreamSourceNode();
    addModule.mockResolvedValue(undefined);

    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream);

    class FakeAudioContext {
      readonly audioWorklet = { addModule };
      readonly destination = {};
      readonly sampleRate = 48_000;
      readonly state = "running";
      close = vi.fn();
      decodeAudioData = decodeAudioData;
      resume = vi.fn();

      createMediaStreamSource() {
        return sourceNode;
      }
    }

    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:realtime-microphone-worklet"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("streams PCM chunks from Web Audio without decoding MediaRecorder blobs", async () => {
    const user = userEvent.setup();
    const onChunk = vi.fn();

    render(<TestHarness onChunk={onChunk} />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    await waitFor(() => expect(addModule).toHaveBeenCalled());

    act(() => {
      FakeAudioWorkletNode.instance?.port.onmessage?.({
        data: {
          sampleRate: 16_000,
          samples: new Float32Array([0, 0.5, -0.5]),
          type: "chunk",
        },
      });
    });

    await waitFor(() => expect(onChunk).toHaveBeenCalledTimes(1));

    expect(onChunk.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
    expect(onChunk.mock.calls[0]?.[0]).toHaveLength(6);
    expect(screen.getByTestId("chunk-count")).toHaveTextContent("1");
    expect(sourceNode.connect).toHaveBeenCalledWith(FakeAudioWorkletNode.instance);
    expect(decodeAudioData).not.toHaveBeenCalled();
  });

  it("resamples capture to a custom target sample rate when provided", async () => {
    const user = userEvent.setup();
    const onChunk = vi.fn();

    render(<TestHarness onChunk={onChunk} targetSampleRate={24_000} />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(addModule).toHaveBeenCalled());

    act(() => {
      FakeAudioWorkletNode.instance?.port.onmessage?.({
        data: {
          sampleRate: 48_000,
          samples: new Float32Array([0, 0.1, 0.2, 0.3, 0.4, 0.5]),
          type: "chunk",
        },
      });
    });

    await waitFor(() => expect(onChunk).toHaveBeenCalledTimes(1));

    // 48 kHz -> 24 kHz halves the samples: 6 floats -> 3 samples -> 6 bytes.
    expect(onChunk.mock.calls[0]?.[0]).toHaveLength(6);
  });

  it("flushes trailing worklet samples before stopping capture", async () => {
    const user = userEvent.setup();
    const onChunk =
      vi.fn<(chunk: Uint8Array) => Promise<void>>().mockResolvedValue(undefined);

    render(<TestHarness onChunk={onChunk} />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(addModule).toHaveBeenCalled());

    const workletNode = FakeAudioWorkletNode.instance;
    expect(workletNode).not.toBeNull();
    workletNode!.port.flushSamples = new Float32Array([0.25, -0.25]);

    await user.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => expect(onChunk).toHaveBeenCalledTimes(1));

    expect(workletNode!.port.postMessage).toHaveBeenCalledWith({ type: "flush" });
    expect(onChunk.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
    expect(onChunk.mock.calls[0]?.[0]).toHaveLength(4);
    expect(workletNode!.disconnect).toHaveBeenCalled();
    expect(sourceNode.disconnect).toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
  });

  it("returns the same in-flight stop promise for concurrent stop calls", async () => {
    let microphone: ReturnType<typeof useMicrophone> | null = null;

    render(<HookProbe onRender={(nextMicrophone) => {
      microphone = nextMicrophone;
    }} />);

    await act(async () => {
      await microphone!.start({ onChunk: vi.fn() });
    });

    const workletNode = FakeAudioWorkletNode.instance;
    expect(workletNode).not.toBeNull();
    workletNode!.port.deferFlush = true;

    const firstStop = microphone!.stop();
    const secondStop = microphone!.stop();

    expect(secondStop).toBe(firstStop);
    expect(workletNode!.port.postMessage).toHaveBeenCalledTimes(1);

    act(() => {
      workletNode!.port.flush();
    });

    await firstStop;
    await secondStop;
    expect(workletNode!.disconnect).toHaveBeenCalledTimes(1);
  });

  it("stops the acquired stream if worklet node creation fails", async () => {
    let microphone: ReturnType<typeof useMicrophone> | null = null;
    FakeAudioWorkletNode.shouldThrow = true;

    render(<HookProbe onRender={(nextMicrophone) => {
      microphone = nextMicrophone;
    }} />);

    await expect(
      act(async () => {
        await microphone!.start({ onChunk: vi.fn() });
      }),
    ).rejects.toThrow("Unable to create worklet node");

    expect(sourceNode.disconnect).toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
  });
});
