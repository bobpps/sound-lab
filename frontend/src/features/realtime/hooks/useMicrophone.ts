import { useCallback, useEffect, useRef, useState } from "react";

const TARGET_SAMPLE_RATE = 16_000;

export interface UseMicrophoneStartOptions {
  mimeType?: string;
  onChunk?: (chunk: Uint8Array) => void | Promise<void>;
  timeSliceMs?: number;
}

interface UseMicrophoneResult {
  chunks: Uint8Array[];
  error: string | null;
  isRecording: boolean;
  start: (options?: UseMicrophoneStartOptions) => Promise<void>;
  stop: () => void;
}

type RecorderWithMimeSupport = typeof MediaRecorder & {
  isTypeSupported?: (mimeType: string) => boolean;
};

function getAudioContextConstructor():
  | (new () => AudioContext)
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.AudioContext ?? (window as typeof window & {
    webkitAudioContext?: new () => AudioContext;
  }).webkitAudioContext;
}

function chooseRecorderMimeType(preferred?: string): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const recorder = MediaRecorder as RecorderWithMimeSupport;
  const supported = recorder.isTypeSupported?.bind(recorder);

  const candidates = [
    preferred,
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ].filter((value): value is string => Boolean(value));

  if (!supported) {
    return candidates[0];
  }

  return candidates.find((mimeType) => supported(mimeType));
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const mono = new Float32Array(audioBuffer.length);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let index = 0; index < channelData.length; index += 1) {
      mono[index] += channelData[index] / audioBuffer.numberOfChannels;
    }
  }

  return mono;
}

function downsampleBuffer(
  input: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number,
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return input;
  }

  const sampleRateRatio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.round(input.length / sampleRateRatio);
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

async function convertBlobToPcm16(
  blob: Blob,
  audioContext: AudioContext,
): Promise<Uint8Array> {
  const sourceBuffer = await blob.arrayBuffer();
  const decodedBuffer = await audioContext.decodeAudioData(sourceBuffer.slice(0));
  const mono = mixToMono(decodedBuffer);
  const resampled = downsampleBuffer(
    mono,
    decodedBuffer.sampleRate,
    TARGET_SAMPLE_RATE,
  );

  return floatToPcm16(resampled);
}

export function useMicrophone(): UseMicrophoneResult {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunkHandlerRef = useRef<UseMicrophoneStartOptions["onChunk"]>(undefined);

  const [chunks, setChunks] = useState<Uint8Array[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const start = useCallback(async (options: UseMicrophoneStartOptions = {}) => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Microphone capture is not supported in this browser.");
      throw new Error("Microphone capture is not supported in this browser.");
    }

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
      setError("Audio processing is not supported in this browser.");
      throw new Error("Audio processing is not supported in this browser.");
    }

    stop();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = chooseRecorderMimeType(options.mimeType);
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    chunkHandlerRef.current = options.onChunk;
    streamRef.current = stream;
    recorderRef.current = recorder;

    setChunks([]);
    setError(null);
    setIsRecording(true);

    recorder.ondataavailable = (event) => {
      if (event.data.size === 0 || !audioContextRef.current) {
        return;
      }

      void (async () => {
        try {
          const pcmChunk = await convertBlobToPcm16(
            event.data,
            audioContextRef.current!,
          );

          setChunks((currentChunks) => [...currentChunks, pcmChunk]);
          await chunkHandlerRef.current?.(pcmChunk);
        } catch (processingError) {
          const message =
            processingError instanceof Error
              ? processingError.message
              : "Unable to process microphone audio.";
          setError(message);
        }
      })();
    };

    recorder.onerror = () => {
      setError("Microphone recording failed.");
      stop();
    };

    recorder.onstop = () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      recorderRef.current = null;
      setIsRecording(false);
    };

    recorder.start(options.timeSliceMs ?? 400);
  }, [stop]);

  useEffect(() => {
    return () => {
      stop();

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
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
