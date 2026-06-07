import { useCallback, useEffect, useRef, useState } from "react";

export interface RealtimeConnectConfig {
  geminiModelSettings?: {
    enableAffectiveDialog?: boolean;
    proactivity?: {
      proactiveAudio: boolean;
    };
    realtimeInputConfig?: {
      turnCoverage:
        | "TURN_INCLUDES_ONLY_ACTIVITY"
        | "TURN_INCLUDES_ALL_INPUT"
        | "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO";
    };
    thinkingConfig?: {
      includeThoughts?: boolean;
      thinkingBudget?: number;
      thinkingLevel?: "minimal" | "low" | "medium" | "high";
    };
  };
  geminiTranscriptMode?: "live" | "final";
  language?: string;
  model: string;
  systemPrompt: string;
  voice?: string;
}

export interface TranscriptEntry {
  id: string;
  final: boolean;
  receivedAt: number;
  role: "assistant" | "system" | "user";
  text: string;
}

interface RealtimeSocketEvent {
  type?: string;
  data?: unknown;
}

interface RealtimeSessionResult {
  clearTranscripts: () => void;
  connect: (config: RealtimeConnectConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  sendAudio: (chunk: Blob | Uint8Array | ArrayBuffer) => Promise<void>;
  transcripts: TranscriptEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createTranscriptId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createWebSocketUrl(providerId: string): string {
  const url = new URL(`/api/realtime/${providerId}/session`, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function parseSampleRate(mimeType?: string): number {
  if (!mimeType) {
    return 16_000;
  }

  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : 16_000;
}

function pcm16ToWav(pcmBytes: Uint8Array, sampleRate: number): ArrayBuffer {
  const headerSize = 44;
  const wavBuffer = new ArrayBuffer(headerSize + pcmBytes.byteLength);
  const view = new DataView(wavBuffer);
  const bytesPerSample = 2;
  const channelCount = 1;
  const byteRate = sampleRate * channelCount * bytesPerSample;

  const writeAscii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.byteLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, pcmBytes.byteLength, true);
  new Uint8Array(wavBuffer, headerSize).set(pcmBytes);

  return wavBuffer;
}

function decodeBase64Chunk(chunk: string): Uint8Array {
  const binary = window.atob(chunk);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary);
}

async function toUint8Array(
  chunk: Blob | Uint8Array | ArrayBuffer,
): Promise<Uint8Array> {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }

  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }

  return new Uint8Array(await chunk.arrayBuffer());
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (isRecord(data) && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  return fallback;
}

function appendTranscript(
  current: TranscriptEntry[],
  next: Omit<TranscriptEntry, "id" | "receivedAt">,
): TranscriptEntry[] {
  if (!next.text.trim()) {
    return current;
  }

  const previous = current.at(-1);
  if (previous && previous.role === next.role && previous.final === false) {
    return [
      ...current.slice(0, -1),
      {
        ...previous,
        final: next.final,
        text: next.text,
        receivedAt: Date.now(),
      },
    ];
  }

  return [
    ...current,
    {
      ...next,
      id: createTranscriptId(),
      receivedAt: Date.now(),
    },
  ];
}

export function useRealtimeSession(providerId: string): RealtimeSessionResult {
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Promise<void>>(Promise.resolve());
  const startupPromiseRef = useRef<{
    reject: (error: Error) => void;
    resolve: () => void;
  } | null>(null);
  const intentionalCloseRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & {
        webkitAudioContext?: new () => AudioContext;
      }).webkitAudioContext;

    if (!AudioContextCtor) {
      throw new Error("Audio playback is not supported in this browser.");
    }

    audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  }, []);

  const playAudioChunk = useCallback(async (chunk: string, mimeType?: string) => {
    audioQueueRef.current = audioQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const audioContext = ensureAudioContext();
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const sourceBytes = decodeBase64Chunk(chunk);
        const sourceBuffer = mimeType?.startsWith("audio/pcm")
          ? pcm16ToWav(sourceBytes, parseSampleRate(mimeType))
          : toArrayBuffer(sourceBytes);
        const audioBuffer = await audioContext.decodeAudioData(sourceBuffer.slice(0));
        const sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioContext.destination);

        await new Promise<void>((resolve) => {
          sourceNode.onended = () => resolve();
          sourceNode.start(0);
        });
      })
      .catch((playbackError) => {
        setError(
          playbackError instanceof Error
            ? playbackError.message
            : "Unable to play the realtime audio response.",
        );
      });

    await audioQueueRef.current;
  }, [ensureAudioContext]);

  const rejectStartup = useCallback((message: string) => {
    if (!startupPromiseRef.current) {
      return;
    }

    startupPromiseRef.current.reject(new Error(message));
    startupPromiseRef.current = null;
  }, []);

  const resolveStartup = useCallback(() => {
    if (!startupPromiseRef.current) {
      return;
    }

    startupPromiseRef.current.resolve();
    startupPromiseRef.current = null;
  }, []);

  const closeSocket = useCallback(async (notifyServer: boolean) => {
    const socket = socketRef.current;
    socketRef.current = null;

    if (!socket) {
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    intentionalCloseRef.current = true;

    if (notifyServer && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "session_end" }));
    }

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close(1000, "Client disconnected");
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  const connect = useCallback(async (config: RealtimeConnectConfig) => {
    await closeSocket(false);

    intentionalCloseRef.current = false;
    setError(null);
    setTranscripts([]);
    setIsConnecting(true);
    setIsConnected(false);

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(createWebSocketUrl(providerId));
      socketRef.current = socket;
      startupPromiseRef.current = { resolve, reject };

      socket.onopen = () => {
        if (socketRef.current !== socket) {
          return;
        }

        socket.send(
          JSON.stringify({
            type: "session_start",
            data: config,
          }),
        );
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        if (socketRef.current !== socket) {
          return;
        }

        let message: RealtimeSocketEvent;
        try {
          message = JSON.parse(event.data) as RealtimeSocketEvent;
        } catch {
          setError("Received an invalid realtime event.");
          rejectStartup("Received an invalid realtime event.");
          return;
        }

        switch (message.type) {
          case "session_start":
            setIsConnecting(false);
            setIsConnected(true);
            setError(null);
            resolveStartup();
            return;

          case "transcript": {
            if (!isRecord(message.data)) {
              return;
            }

            const role = message.data.role;
            const text = message.data.text;
            const final = message.data.final;

            if (
              (role === "user" || role === "assistant" || role === "system") &&
              typeof text === "string"
            ) {
              setTranscripts((current) =>
                appendTranscript(current, {
                  final: typeof final === "boolean" ? final : true,
                  role,
                  text,
                }),
              );
            }
            return;
          }

          case "audio":
            if (
              isRecord(message.data) &&
              typeof message.data.chunk === "string"
            ) {
              void playAudioChunk(
                message.data.chunk,
                typeof message.data.mimeType === "string"
                  ? message.data.mimeType
                  : undefined,
              );
            }
            return;

          case "error": {
            const nextError = getErrorMessage(
              message.data,
              "Realtime session error.",
            );
            setError(nextError);

            if (startupPromiseRef.current) {
              rejectStartup(nextError);
            }
            return;
          }

          case "session_end":
            setIsConnecting(false);
            setIsConnected(false);
            if (startupPromiseRef.current) {
              rejectStartup("The realtime session ended before it was ready.");
            }
            if (socket.readyState === WebSocket.OPEN) {
              socket.close(1000, "Session ended");
            }
            return;

          default:
            return;
        }
      };

      socket.onerror = () => {
        if (socketRef.current !== socket) {
          return;
        }

        const nextError = "Unable to connect to the realtime session.";
        setError(nextError);
        setIsConnecting(false);
        setIsConnected(false);
        rejectStartup(nextError);
      };

      socket.onclose = (event) => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        } else {
          return;
        }

        setIsConnecting(false);
        setIsConnected(false);

        if (!intentionalCloseRef.current && startupPromiseRef.current) {
          rejectStartup(
            event.reason || "The realtime session closed before it was ready.",
          );
          return;
        }

        startupPromiseRef.current = null;
      };
    });
  }, [closeSocket, playAudioChunk, providerId, rejectStartup, resolveStartup]);

  const disconnect = useCallback(async () => {
    await closeSocket(true);
  }, [closeSocket]);

  const sendAudio = useCallback(async (chunk: Blob | Uint8Array | ArrayBuffer) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const bytes = await toUint8Array(chunk);
    socket.send(
      JSON.stringify({
        type: "audio",
        data: toBase64(bytes),
      }),
    );
  }, []);

  useEffect(() => {
    return () => {
      void closeSocket(false);

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [closeSocket]);

  return {
    clearTranscripts,
    connect,
    disconnect,
    error,
    isConnected,
    isConnecting,
    sendAudio,
    transcripts,
  };
}
