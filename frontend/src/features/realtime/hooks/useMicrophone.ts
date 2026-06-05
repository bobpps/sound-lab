import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_TARGET_SAMPLE_RATE = 16_000;
const MICROPHONE_WORKLET_NAME = "realtime-microphone-processor";
const MICROPHONE_WORKLET_SOURCE = `
class RealtimeMicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.offset = 0;
    this.port.onmessage = (event) => {
      if (event.data?.type === "flush") {
        this.flush();
      }
    };
  }

  flush() {
    const samples = this.offset > 0
      ? this.buffer.slice(0, this.offset)
      : new Float32Array(0);

    this.port.postMessage(
      { type: "flushed", sampleRate, samples },
      [samples.buffer],
    );

    this.buffer = new Float32Array(4096);
    this.offset = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0 || channels[0].length === 0) {
      return true;
    }

    const frameCount = channels[0].length;
    for (let frame = 0; frame < frameCount; frame += 1) {
      let sample = 0;
      for (let channel = 0; channel < channels.length; channel += 1) {
        sample += channels[channel][frame] / channels.length;
      }

      this.buffer[this.offset] = sample;
      this.offset += 1;

      if (this.offset === this.buffer.length) {
        const samples = this.buffer;
        this.port.postMessage(
          { type: "chunk", sampleRate, samples },
          [samples.buffer],
        );
        this.buffer = new Float32Array(4096);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("${MICROPHONE_WORKLET_NAME}", RealtimeMicrophoneProcessor);
`;

const loadedAudioWorklets = new WeakSet<AudioContext>();

export interface UseMicrophoneStartOptions {
  onChunk?: (chunk: Uint8Array) => void | Promise<void>;
  // PCM rate the captured audio is resampled to before being sent to the
  // realtime provider. Defaults to 16 kHz; OpenAI Realtime requires 24 kHz.
  targetSampleRate?: number;
}

interface UseMicrophoneResult {
  chunks: Uint8Array[];
  error: string | null;
  isRecording: boolean;
  start: (options?: UseMicrophoneStartOptions) => Promise<void>;
  stop: () => Promise<void>;
}

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.AudioContext ?? (window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  }).webkitAudioContext;
}

function downsampleBuffer(
  input: Float32Array,
  sampleRateRatio: number,
  outputLength: number,
): Float32Array {
  const output = new Float32Array(outputLength);

  let inputIndex = 0;
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const nextInputIndex = Math.round((outputIndex + 1) * sampleRateRatio);
    let sum = 0;
    let count = 0;

    for (
      let sampleIndex = inputIndex;
      sampleIndex < nextInputIndex && sampleIndex < input.length;
      sampleIndex += 1
    ) {
      sum += input[sampleIndex];
      count += 1;
    }

    output[outputIndex] = count > 0 ? sum / count : 0;
    inputIndex = nextInputIndex;
  }

  return output;
}

function upsampleBuffer(
  input: Float32Array,
  sampleRateRatio: number,
  outputLength: number,
): Float32Array {
  const output = new Float32Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const sourcePosition = outputIndex * sampleRateRatio;
    const lowerIndex = Math.floor(sourcePosition);
    const upperIndex = Math.min(lowerIndex + 1, input.length - 1);
    const fraction = sourcePosition - lowerIndex;

    output[outputIndex] =
      input[lowerIndex] + (input[upperIndex] - input[lowerIndex]) * fraction;
  }

  return output;
}

// Resamples mono float audio to the target rate. Downsampling averages source
// windows (anti-aliasing); upsampling interpolates linearly. A plain
// downsample-only path would zero-stuff when the source rate is below the
// target, distorting the audio sent to providers like OpenAI (24 kHz).
function resampleBuffer(
  input: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number,
): Float32Array {
  if (sourceSampleRate === targetSampleRate || input.length === 0) {
    return input;
  }

  const sampleRateRatio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / sampleRateRatio));

  return sourceSampleRate > targetSampleRate
    ? downsampleBuffer(input, sampleRateRatio, outputLength)
    : upsampleBuffer(input, sampleRateRatio, outputLength);
}

function floatToPcm16(input: Float32Array): Uint8Array {
  const view = new DataView(new ArrayBuffer(input.length * 2));

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(
      index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }

  return new Uint8Array(view.buffer);
}

async function loadMicrophoneWorklet(audioContext: AudioContext): Promise<void> {
  if (loadedAudioWorklets.has(audioContext)) {
    return;
  }

  if (!audioContext.audioWorklet) {
    throw new Error("AudioWorklet microphone processing is not supported in this browser.");
  }

  const moduleUrl = URL.createObjectURL(
    new Blob([MICROPHONE_WORKLET_SOURCE], { type: "text/javascript" }),
  );

  try {
    await audioContext.audioWorklet.addModule(moduleUrl);
    loadedAudioWorklets.add(audioContext);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

export function useMicrophone(): UseMicrophoneResult {
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunkHandlerRef = useRef<UseMicrophoneStartOptions["onChunk"]>(undefined);
  const flushResolverRef = useRef<(() => void) | null>(null);
  const pendingChunkSendsRef = useRef<Promise<void>>(Promise.resolve());
  const stopPromiseRef = useRef<Promise<void> | null>(null);

  const [chunks, setChunks] = useState<Uint8Array[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const stop = useCallback((): Promise<void> => {
    if (stopPromiseRef.current) {
      return stopPromiseRef.current;
    }

    const stopPromise = (async () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      const workletNode = workletNodeRef.current;
      if (workletNode) {
        await new Promise<void>((resolve) => {
          let isSettled = false;
          const timeoutId = window.setTimeout(finish, 500);
          function finish() {
            if (isSettled) {
              return;
            }

            isSettled = true;
            window.clearTimeout(timeoutId);
            flushResolverRef.current = null;
            resolve();
          }

          flushResolverRef.current = finish;

          try {
            workletNode.port.postMessage({ type: "flush" });
          } catch {
            finish();
          }
        });

        workletNode.port.onmessage = null;
        workletNode.disconnect();
        workletNodeRef.current = null;
      }

      chunkHandlerRef.current = undefined;
      setIsRecording(false);
    })().finally(() => {
      stopPromiseRef.current = null;
    });

    stopPromiseRef.current = stopPromise;
    return stopPromise;
  }, []);

  const start = useCallback(async (options: UseMicrophoneStartOptions = {}) => {
    const targetSampleRate = options.targetSampleRate ?? DEFAULT_TARGET_SAMPLE_RATE;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Microphone capture is not supported in this browser.");
      throw new Error("Microphone capture is not supported in this browser.");
    }

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
      setError("Audio processing is not supported in this browser.");
      throw new Error("Audio processing is not supported in this browser.");
    }

    await stop();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    const audioContext = audioContextRef.current;
    try {
      await loadMicrophoneWorklet(audioContext);
    } catch (workletError) {
      for (const track of stream.getTracks()) {
        track.stop();
      }

      const message =
        workletError instanceof Error
          ? workletError.message
          : "Unable to initialize microphone audio processing.";
      setError(message);
      throw new Error(message);
    }

    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let workletNode: AudioWorkletNode | null = null;
    try {
      sourceNode = audioContext.createMediaStreamSource(stream);
      workletNode = new AudioWorkletNode(
        audioContext,
        MICROPHONE_WORKLET_NAME,
        {
          numberOfInputs: 1,
          numberOfOutputs: 0,
        },
      );
    } catch (nodeError) {
      sourceNode?.disconnect();
      for (const track of stream.getTracks()) {
        track.stop();
      }

      const message =
        nodeError instanceof Error
          ? nodeError.message
          : "Unable to initialize microphone audio processing.";
      setError(message);
      throw new Error(message);
    }

    chunkHandlerRef.current = options.onChunk;
    streamRef.current = stream;
    sourceNodeRef.current = sourceNode;
    workletNodeRef.current = workletNode;

    setChunks([]);
    setError(null);
    setIsRecording(true);

    workletNode.port.onmessage = (event: MessageEvent<{
      sampleRate?: number;
      samples?: Float32Array;
      type?: string;
    }>) => {
      if (!workletNodeRef.current || !(event.data.samples instanceof Float32Array)) {
        if (event.data.type === "flushed") {
          flushResolverRef.current?.();
          flushResolverRef.current = null;
        }
        return;
      }

      const resampled = resampleBuffer(
        event.data.samples,
        event.data.sampleRate ?? audioContext.sampleRate,
        targetSampleRate,
      );
      const pcmChunk = floatToPcm16(resampled);

      pendingChunkSendsRef.current = pendingChunkSendsRef.current
        .catch(() => undefined)
        .then(async () => {
          if (pcmChunk.byteLength === 0) {
            return;
          }

          setChunks((currentChunks) => [...currentChunks, pcmChunk]);
          await chunkHandlerRef.current?.(pcmChunk);
        })
        .catch((processingError) => {
          const message =
            processingError instanceof Error
              ? processingError.message
              : "Unable to process microphone audio.";
          setError(message);
        })
        .finally(() => {
          if (event.data.type === "flushed") {
            flushResolverRef.current?.();
            flushResolverRef.current = null;
          }
        });

      void pendingChunkSendsRef.current;
    };

    sourceNode.connect(workletNode);
  }, [stop]);

  useEffect(() => {
    return () => {
      void stop().finally(() => {
        if (audioContextRef.current) {
          void audioContextRef.current.close();
          audioContextRef.current = null;
        }
      });
    };
  }, [stop]);

  return {
    chunks,
    error,
    isRecording,
    start,
    stop,
  };
}
