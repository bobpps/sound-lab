import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMicrophone } from "./useMicrophone.ts";

interface FakeWorkletMessage {
  data: {
    sampleRate: number;
    samples: Float32Array;
  };
}

class FakeAudioWorkletPort {
  onmessage: ((event: FakeWorkletMessage) => void) | null = null;
}

class FakeAudioWorkletNode {
  static instance: FakeAudioWorkletNode | null = null;

  readonly port = new FakeAudioWorkletPort();
  disconnect = vi.fn();

  constructor() {
    FakeAudioWorkletNode.instance = this;
  }
}

class FakeMediaStreamSourceNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

function TestHarness({ onChunk }: { onChunk: (chunk: Uint8Array) => void }) {
  const microphone = useMicrophone();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void microphone.start({ onChunk });
        }}
      >
        Start
      </button>
      <button type="button" onClick={microphone.stop}>
        Stop
      </button>
      <span data-testid="chunk-count">{microphone.chunks.length}</span>
      {microphone.error ? <span role="alert">{microphone.error}</span> : null}
    </div>
  );
}

describe("useMicrophone", () => {
  const getUserMedia = vi.fn<() => Promise<MediaStream>>();
  const trackStop = vi.fn();
  const addModule = vi.fn();
  const decodeAudioData = vi.fn();
  let sourceNode: FakeMediaStreamSourceNode;

  beforeEach(() => {
    FakeAudioWorkletNode.instance = null;
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
});
