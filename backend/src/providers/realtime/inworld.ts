import { randomUUID } from 'node:crypto';
import WebSocket, { type RawData } from 'ws';
import type {
  IRealtimeProvider,
  IRealtimeSession,
  RealtimeEvent,
  RealtimeSessionConfig,
} from './types.js';

const INWORLD_BASE_URL = 'https://api.inworld.ai';
const INWORLD_MODELS_URL = `${INWORLD_BASE_URL}/v1/models`;
const INWORLD_REALTIME_URL = 'wss://api.inworld.ai/api/v1/realtime/session';
const DEFAULT_REALTIME_MODEL = 'google-ai-studio/gemini-2.5-flash';
const DEFAULT_VOICE = 'Dennis';
const DEFAULT_TTS_MODEL = 'inworld-tts-1.5-mini';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toBuffer(raw: RawData): Buffer {
  if (typeof raw === 'string') {
    return Buffer.from(raw);
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw);
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw.map((chunk) => toBuffer(chunk)));
  }

  return Buffer.from(raw);
}

function parseJsonMessage(raw: RawData): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(toBuffer(raw).toString());
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function extractRealtimeError(message: Record<string, unknown>): {
  message: string;
  code?: string;
  type?: string;
  eventId?: string;
} {
  const upstreamError = isRecord(message.error) ? message.error : null;
  const errorMessage = typeof upstreamError?.message === 'string'
    ? upstreamError.message
    : 'Inworld Realtime API error';

  return {
    message: errorMessage,
    code: typeof upstreamError?.code === 'string' ? upstreamError.code : undefined,
    type: typeof upstreamError?.type === 'string' ? upstreamError.type : undefined,
    eventId: typeof message.event_id === 'string' ? message.event_id : undefined,
  };
}

function createTranscriptEvent(
  role: 'user' | 'assistant',
  text: string,
  final: boolean,
  message: Record<string, unknown>,
): RealtimeEvent {
  return {
    type: 'transcript',
    data: {
      role,
      text,
      final,
      itemId: typeof message.item_id === 'string' ? message.item_id : undefined,
      responseId: typeof message.response_id === 'string' ? message.response_id : undefined,
      contentIndex: typeof message.content_index === 'number' ? message.content_index : undefined,
      outputIndex: typeof message.output_index === 'number' ? message.output_index : undefined,
    },
  };
}

function createAudioEvent(message: Record<string, unknown>): RealtimeEvent | null {
  if (typeof message.delta !== 'string') {
    return null;
  }

  return {
    type: 'audio',
    data: {
      chunk: message.delta,
      itemId: typeof message.item_id === 'string' ? message.item_id : undefined,
      responseId: typeof message.response_id === 'string' ? message.response_id : undefined,
      contentIndex: typeof message.content_index === 'number' ? message.content_index : undefined,
      outputIndex: typeof message.output_index === 'number' ? message.output_index : undefined,
    },
  };
}

function createErrorEvent(message: string, details?: Record<string, unknown>): RealtimeEvent {
  return {
    type: 'error',
    data: {
      message,
      ...details,
    },
  };
}

function sendJson(socket: WebSocket, payload: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.send(JSON.stringify(payload), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function closeSocket(socket: WebSocket, code: number, reason: string): void {
  if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
    return;
  }

  socket.close(code, reason);
}

async function readErrorResponse(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.clone().json();
    if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string') {
      return body.error.message;
    }

    if (isRecord(body) && typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // Ignore JSON parsing failures and fall back to raw text.
  }

  try {
    const text = await response.clone().text();
    if (text.trim()) {
      return text;
    }
  } catch {
    // Ignore text parsing failures.
  }

  return fallback;
}

function createSessionKey(): string {
  return `voice-${Date.now()}-${randomUUID()}`;
}

function buildSessionUpdate(config: RealtimeSessionConfig): Record<string, unknown> {
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      model: config.model,
      instructions: config.systemPrompt,
      output_modalities: ['audio'],
      audio: {
        input: {
          turn_detection: {
            type: 'semantic_vad',
            eagerness: 'medium',
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          voice: config.voice ?? DEFAULT_VOICE,
          model: DEFAULT_TTS_MODEL,
          speed: 1,
        },
      },
    },
  };
}

class InworldRealtimeSession implements IRealtimeSession {
  private closePromise: Promise<void> | null = null;
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly suppressRemoteSessionEnd: () => void,
  ) {}

  async sendAudio(chunk: Buffer): Promise<void> {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Inworld Realtime session is not open');
    }

    await sendJson(this.socket, {
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64'),
    });
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closed = true;
    this.suppressRemoteSessionEnd();

    if (this.socket.readyState === WebSocket.CLOSED) {
      this.closePromise = Promise.resolve();
      return this.closePromise;
    }

    this.closePromise = new Promise((resolve) => {
      this.socket.once('close', () => {
        resolve();
      });

      if (this.socket.readyState === WebSocket.CLOSING) {
        return;
      }

      this.socket.close(1000, 'Session closed');
    });

    return this.closePromise;
  }
}

export class InworldRealtimeProvider implements IRealtimeProvider {
  readonly id = 'inworld-realtime';
  readonly name = 'Inworld Realtime';

  constructor(private readonly apiKey: string) {}

  async getModels(): Promise<string[]> {
    const response = await fetch(INWORLD_MODELS_URL, {
      headers: {
        Authorization: `Basic ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const message = await readErrorResponse(
        response,
        `Inworld models API error (${response.status})`,
      );
      throw new Error(`Inworld models API error: ${message}`);
    }

    const body = await response.json();
    if (!isRecord(body)) {
      return [DEFAULT_REALTIME_MODEL];
    }

    const models = new Set<string>();
    const items = Array.isArray(body.data) ? body.data : [];

    for (const item of items) {
      if (!isRecord(item) || typeof item.id !== 'string' || !item.id) {
        continue;
      }

      models.add(item.id);
    }

    return models.size > 0 ? [...models].sort() : [DEFAULT_REALTIME_MODEL];
  }

  async createSession(
    config: RealtimeSessionConfig,
    onEvent: (event: RealtimeEvent) => void,
  ): Promise<IRealtimeSession> {
    const url = new URL(INWORLD_REALTIME_URL);
    url.searchParams.set('key', createSessionKey());
    url.searchParams.set('protocol', 'realtime');

    const socket = new WebSocket(url, {
      headers: {
        Authorization: `Basic ${this.apiKey}`,
      },
    });

    let session: InworldRealtimeSession | null = null;
    let startupSettled = false;
    let remoteSessionEndEnabled = true;
    let sessionConfigured = false;

    const suppressRemoteSessionEnd = (): void => {
      remoteSessionEndEnabled = false;
    };

    return new Promise<IRealtimeSession>((resolve, reject) => {
      const settleStartup = (
        kind: 'resolve' | 'reject',
        payload: IRealtimeSession | Error,
      ): void => {
        if (startupSettled) {
          return;
        }

        startupSettled = true;

        if (kind === 'resolve') {
          resolve(payload as IRealtimeSession);
          return;
        }

        reject(payload as Error);
      };

      const failStartup = (message: string): void => {
        suppressRemoteSessionEnd();
        settleStartup('reject', new Error(message));
        closeSocket(socket, 1011, message);
      };

      const configureSession = (): void => {
        if (sessionConfigured) {
          return;
        }

        sessionConfigured = true;

        void sendJson(socket, buildSessionUpdate(config)).catch((error) => {
          sessionConfigured = false;
          failStartup(getErrorMessage(error, 'Failed to configure Inworld realtime session'));
        });
      };

      socket.on('message', (rawMessage) => {
        const message = parseJsonMessage(rawMessage);
        if (!message) {
          onEvent(createErrorEvent(
            'Invalid JSON event received from Inworld Realtime API',
            { source: 'inworld' },
          ));
          return;
        }

        switch (message.type) {
          case 'session.created':
            configureSession();
            return;

          case 'session.updated':
            if (!session) {
              session = new InworldRealtimeSession(socket, suppressRemoteSessionEnd);
            }

            settleStartup('resolve', session);
            return;

          case 'conversation.item.input_audio_transcription.delta':
            if (typeof message.delta === 'string') {
              onEvent(createTranscriptEvent('user', message.delta, false, message));
            }
            return;

          case 'conversation.item.input_audio_transcription.completed':
            if (typeof message.transcript === 'string') {
              onEvent(createTranscriptEvent('user', message.transcript, true, message));
            }
            return;

          case 'response.output_audio.delta': {
            const audioEvent = createAudioEvent(message);
            if (audioEvent) {
              onEvent(audioEvent);
            }
            return;
          }

          case 'response.output_audio_transcript.delta':
            if (typeof message.delta === 'string') {
              onEvent(createTranscriptEvent('assistant', message.delta, false, message));
            }
            return;

          case 'response.output_audio_transcript.done':
            if (typeof message.transcript === 'string') {
              onEvent(createTranscriptEvent('assistant', message.transcript, true, message));
            }
            return;

          case 'error': {
            const realtimeError = extractRealtimeError(message);
            onEvent(createErrorEvent(realtimeError.message, {
              code: realtimeError.code,
              source: 'inworld',
              upstreamType: realtimeError.type,
              eventId: realtimeError.eventId,
            }));

            if (!startupSettled) {
              failStartup(realtimeError.message);
            }
            return;
          }

          default:
            return;
        }
      });

      socket.on('error', (error) => {
        const message = getErrorMessage(error, 'Inworld Realtime websocket error');
        onEvent(createErrorEvent(message, { source: 'inworld' }));

        if (!startupSettled) {
          failStartup(message);
        }
      });

      socket.on('close', (code, reason) => {
        const closeReason = toBuffer(reason).toString();

        if (!startupSettled) {
          settleStartup(
            'reject',
            new Error(
              closeReason || `Inworld Realtime socket closed before session was ready (${code})`,
            ),
          );
          return;
        }

        if (remoteSessionEndEnabled) {
          onEvent({
            type: 'session_end',
            data: {
              code,
              reason: closeReason,
            },
          });
        }
      });
    });
  }
}
